var Transaction = require('bitcoinjs-lib').Transaction
var Address = require('bitcoinjs-lib').Address
var networks = require('bitcoinjs-lib').networks
var assert = require('assert')

function calculateFee(node) {
  var tx = node.tx

  var totalInValue = tx.ins.reduce(function(memo, input) {
    var buffer = new Buffer(input.hash)
    Array.prototype.reverse.call(buffer)
    var inputTxId = buffer.toString('hex')

    var prevNode = node.prevNodes.filter(function(node) {
      return node.id === inputTxId
    })[0]

    assert(prevNode != undefined, 'missing node in graph: ' + inputTxId)

    if(!prevNode.tx) return NaN;

    return memo + prevNode.tx.outs[input.index].value
  }, 0)

  if(isNaN(totalInValue)) return;

  var totalOutValue = tx.outs.reduce(function(memo, output) {
    return memo + output.value
  }, 0)

  return totalInValue - totalOutValue
}

function calculateFeesForPath(node) {
  if(node.prevNodes.length === 0) return;

  node.tx.fee = calculateFee(node)
  node.prevNodes.forEach(calculateFeesForPath)
}

function calculateValue(node, addresses, network) {
  var tx = node.tx

  var relaventInValue = tx.ins.reduce(function(memo, input) {
    var buffer = new Buffer(input.hash)
    Array.prototype.reverse.call(buffer)
    var inputTxId = buffer.toString('hex')

    var prevNode = node.prevNodes.filter(function(node) {
      return node.id === inputTxId
    })[0]

    assert(prevNode != undefined, 'missing node in graph: ' + inputTxId)

    if(!prevNode.tx) return NaN;

    var output = prevNode.tx.outs[input.index]
    var toAddress = Address.fromOutputScript(output.script, network).toString()

    if(addresses.indexOf(toAddress) >= 0) {
      return memo + output.value
    } else {
      return memo
    }
  }, 0)

  if(isNaN(relaventInValue)) return;

  var relaventOutValue = tx.outs.reduce(function(memo, output) {
    var toAddress = Address.fromOutputScript(output.script, network).toString()

    if(addresses.indexOf(toAddress) >= 0) {
      return memo + output.value
    } else {
      return memo
    }
  }, 0)

  return relaventOutValue - relaventInValue
}

function calculateValuesForPath(node, addresses, network) {
  if(node.prevNodes.length === 0) return;

  node.tx.value = calculateValue(node, addresses, network)
  node.prevNodes.forEach(function(node) {
    calculateValuesForPath(node, addresses, network)
  })
}

function parse(txGraph, addresses, network) {
  if(addresses == null || addresses.length < 1) return txGraph;

  network = network || networks.testnet //FIXME
  var results = []

  var tails = txGraph.getTails()
  assertEmptyNodes(tails)

  var tailsNext = tails.reduce(function(memo, node) {
    return memo.concat(node.nextNodes)
  }, [])
  assertNoneFundingNodes(tailsNext, addresses, network)

  txGraph.heads.forEach(calculateFeesForPath)
  txGraph.heads.forEach(function(node) {
    calculateValuesForPath(node, addresses, network)
  })

  return txGraph
}

function assertEmptyNodes(nodes) {
  assert(nodes.every(function(node) {
    return node.tx == null
  }), "expect graph tails to contain only tx ids")
}

function assertNoneFundingNodes(nodes, addresses, network) {
  assert(nodes.every(function(node) {
      var outputAddresses = node.tx.outs.map(function(output) {
        return Address.fromOutputScript(output.script, network).toString()
      })
      var partOfOutput = outputAddresses.some(function(address) {
        addresses.indexOf(address) >= 0
      })

      return !partOfOutput
  }), "expect graph to contain the input transactions of the first funding transactions")

}

module.exports = parse
