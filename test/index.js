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
  })
})

//TODO: p2sh, coinbase
