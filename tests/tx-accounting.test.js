/**
 * Regression: LWS ring-decoy spends must not reduce displayed receive amounts.
 * Run: node tests/tx-accounting.test.js
 */
'use strict';

const assert = require('assert');

// Mirrors dashboard txNetWalletEffect / verifiedSentAtomic (no WASM)
function verifiedSentAtomic (tx, cache) {
  if (!tx.spent_outputs || !tx.spent_outputs.length) return 0n;
  let verified = 0n;
  for (const so of tx.spent_outputs) {
    const cacheKey = so.tx_pub_key + ':' + so.out_index;
    const real = cache[cacheKey];
    if (real && real === so.key_image) verified += BigInt(so.amount || '0');
  }
  return verified;
}

function txNetWalletEffect (tx, cache) {
  const received = BigInt(tx.total_received || '0');
  const sent = verifiedSentAtomic(tx, cache);
  return { received, sent, net: received - sent };
}

const COIN = 10000000000n; // 10 decimals
const cache = {
  'prev_tx:0': 'REAL_KI_300',
};

// Incoming 332 with false ring spend of prior 300 output on same tx hash
const incoming332 = {
  total_received: String(332n * COIN),
  total_sent: String(300n * COIN),
  spent_outputs: [{
    tx_pub_key: 'prev_tx',
    out_index: 0,
    amount: String(300n * COIN),
    key_image: 'DECOY_KI_WRONG',
  }],
};

const effect = txNetWalletEffect(incoming332, cache);
assert.strictEqual(effect.net, 332n * COIN, '332 receive should not be reduced by decoy spend');
assert.strictEqual(effect.sent, 0n);

// Phantom 10 send (decoy only)
const phantom = {
  total_received: '0',
  total_sent: String(10n * COIN),
  spent_outputs: [{
    tx_pub_key: 'x',
    out_index: 1,
    amount: String(10n * COIN),
    key_image: 'DECOY',
  }],
};
const phantomEffect = txNetWalletEffect(phantom, {});
assert.strictEqual(phantomEffect.net, 0n);

console.log('tx-accounting.test.js OK');