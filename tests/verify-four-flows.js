/**
 * verify-four-flows.js — NONO verify page crypto paths (no browser).
 * Run: node tests/verify-four-flows.js
 */
'use strict';
if (!global.crypto) global.crypto = require('crypto').webcrypto;
global.Keccak256 = require('../js/keccak256.js');
global.MoneroEd25519 = require('../js/monero-ed25519.js');
global.MoneroWordList = require('../js/monero-wordlist.js');
require('../js/monero-english-wordlist.js');
require('../js/monero-wordlists-all.js');
global.BIP39_WORDLIST = require('../js/bip39-wordlist.js');
global.Bip39 = require('../js/bip39.js');
global.Polyseed = require('../js/polyseed.js');
global.Networks = require('../js/networks.js');
global.MoneroKeys = require('../js/monero-keys.js');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const net = 'nono-mainnet';

  // 1) Create New
  const created = MoneroKeys.generateWallet('english', net);
  assert(created.address[0] === 'N', 'create: address must start with N');
  assert(created.address.length === 95, 'create: address length 95');
  assert(created.network === net, 'create: network');
  console.log('OK create', created.address.slice(0, 12) + '…');

  // 2) Private Spend Key
  const fromSpend = MoneroKeys.deriveFromSpendKey(created.privateSpendKeyHex, net);
  assert(fromSpend.address === created.address, 'spend key: address match');
  assert(fromSpend.address[0] === 'N', 'spend key: N prefix');
  console.log('OK spend key');

  // 3) Seed phrase (25-word standard)
  const fromSeed = await MoneroKeys.deriveFromAnyMnemonic(created.mnemonic, null, net, '');
  assert(fromSeed.address === created.address, 'seed: round-trip address');
  console.log('OK seed phrase');

  // 4) Watch-only shape (view key + address)
  const viewBytes = MoneroKeys.hexToBytes(fromSpend.privateViewKeyHex);
  const reduced = MoneroEd25519.sc_reduce32(viewBytes);
  const pubView = MoneroEd25519.scalarmultBase(reduced);
  assert(pubView.length === 32, 'watch: pub view');
  assert(/^[1-9A-HJ-NP-Za-km-z]{95}$/.test(created.address), 'watch: addr format');
  console.log('OK watch-only fields');

  console.log('All four NONO verify flows passed.');
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});