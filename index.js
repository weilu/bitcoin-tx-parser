var Transaction = require('bitcoinjs-lib').Transaction
var Address = require('bitcoinjs-lib').Address
var networks = require('bitcoinjs-lib').networks
var assert = require('assert')

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

  txGraph.heads.forEach(function(node) {
    calculateFeesAndValuesForPath(node, addresses, network)
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

function calculateFeesAndValuesForPath(node, addresses, network) {
  if(node.prevNodes.length === 0) return;

  var feeAndValue = calculateFeeAndValue(node, addresses, network)
  node.tx.fee = feeAndValue.fee
  node.tx.value = feeAndValue.value

  node.prevNodes.forEach(function(n) {
    calculateFeesAndValuesForPath(n, addresses, network)
  })
}

function calculateFeeAndValue(node, addresses, network) {
  var tx = node.tx

  var inputFeeAndValue = tx.ins.reduce(function(memo, input) {
    var buffer = new Buffer(input.hash)
    Array.prototype.reverse.call(buffer)
    var inputTxId = buffer.toString('hex')

    var prevNode = node.prevNodes.filter(function(node) {
      return node.id === inputTxId
    })[0]

    assert(prevNode != undefined, 'missing node in graph: ' + inputTxId)

    if(!prevNode.tx) return NaN;

    var output = prevNode.tx.outs[input.index]
    memo.fee = memo.fee + output.value

    var toAddress = Address.fromOutputScript(output.script, network).toString()
    if(addresses.indexOf(toAddress) >= 0) {
      memo.value = memo.value + output.value
    }

    return memo
  }, {fee: 0, value: 0})

  if(isNaN(inputFeeAndValue.fee)) return {};

  var outputFeeAndValue = tx.outs.reduce(function(memo, output) {
    memo.fee = memo.fee + output.value

    var toAddress = Address.fromOutputScript(output.script, network).toString()
    if(addresses.indexOf(toAddress) >= 0) {
      memo.value = memo.value + output.value
    }

    return memo
  }, {fee: 0, value: 0})

  return {
    fee: inputFeeAndValue.fee - outputFeeAndValue.fee,
    value: outputFeeAndValue.value - inputFeeAndValue.value
  }
}

module.exports = parse
