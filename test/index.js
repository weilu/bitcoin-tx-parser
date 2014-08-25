var assert = require('assert')
var TxGraph = require('bitcoin-tx-graph')
var Transaction = require('bitcoinjs-lib').Transaction
var parse = require('../')
var fixtures = require('./fixtures')

describe('parse', function() {
  describe('regular pubkeyhash type of transaction', function() {

    var txs = {}

    var graph = new TxGraph()
    var tx = fixtures.pubkeyhash
    var txObj = Transaction.fromHex(tx.hex)
    graph.addTx(txObj)
    txs[tx.txid] = tx

    tx.ins.forEach(function(input) {
      graph.addTx(Transaction.fromHex(input.prevTx.hex))
      txs[input.prevTx.txid] = input.prevTx

      input.prevTx.ins.forEach(function(input) {
        graph.addTx(Transaction.fromHex(input.prevTx.hex))
        txs[input.prevTx.txid] = input.prevTx
      })
    })

    it('returns the graph unchanged when my addresses are not specified', function() {
      var parsed = parse(graph)
      assert.deepEqual(parsed, graph)
    })

    it('returns the graph unchanged when my addresses is an empty array', function() {
      var parsed = parse(graph, [])
      assert.deepEqual(parsed, graph)
    })

    it('calculates fees and attaches to txs', function() {
      var parsed = parse(graph, tx.ins[0].address)
      parsed.getInOrderTxs().forEach(function(group) {
        group.forEach(function(t) {
          assert.equal(t.fee, txs[t.getId()].fee)
        })
      })
    })

    describe('value', function() {
      it('my address is one of the inputs', function() {
        var input = tx.ins[0]
        var parsed = parse(graph, input.address)
        assert.equal(parsed.findNodeById(tx.txid).tx.value, input.value)
        assert.equal(parsed.findNodeById(input.prevTx.txid).tx.value, input.prevTx.ins[0].prevTx.value)
      })

      it('all inputs are my addresses', function() {
        var parsed = parse(graph, tx.ins.map(function(input) {
          return input.address
        }))

        assert.equal(parsed.findNodeById(tx.txid).tx.value, tx.ins.reduce(function(memo, input) {
          return input.value + memo
        }, 0))
        tx.ins.forEach(function(input) {
          assert.equal(parsed.findNodeById(input.prevTx.txid).tx.value, input.prevTx.ins[0].prevTx.value)
        })
      })

      it('my address is the first input and the first output', function() {
        var input = tx.ins[0]
        var output = tx.outs[0]

        var parsed = parse(graph, [ input.address, output.address ])

        assert.equal(parsed.findNodeById(tx.txid).tx.value, input.value + output.value)
        assert.equal(parsed.findNodeById(input.prevTx.txid).tx.value, input.prevTx.ins[0].prevTx.value)
      })

      it('all inputs are my addresses, plus the first output', function() {
        var output = tx.outs[0]
        var addresses = tx.ins.map(function(input) {
          return input.address
        }).concat(output.address)

        var parsed = parse(graph, addresses)

        var expectedValue = tx.ins.reduce(function(memo, input) {
          return input.value + memo
        }, 0) + output.value
        assert.equal(parsed.findNodeById(tx.txid).tx.value, expectedValue)

        tx.ins.forEach(function(input) {
          assert.equal(parsed.findNodeById(input.prevTx.txid).tx.value, input.prevTx.ins[0].prevTx.value)
        })
      })
    })
  })
})

//TODO: p2sh, coinbase
