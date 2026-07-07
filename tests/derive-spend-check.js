'use strict';
global.crypto = require('crypto').webcrypto;
global.Keccak256 = require('../js/keccak256.js');
global.MoneroEd25519 = require('../js/monero-ed25519.js');
global.MoneroWordList = require('../js/monero-wordlist.js');
require('../js/monero-english-wordlist.js');
global.Networks = require('../js/networks.js');
global.MoneroKeys = require('../js/monero-keys.js');

const spend = process.env.SPEND || '4d592344de123b00fa0f605c41d4fa545795c45c4765499e410ad76f0a66f409';
const userAddr = process.env.USER_ADDR || '46ggsZA86vfio7SiKxVEVw43JFCckdmDtMnGRKsgn2E7KDfXSFBR9xWbjJYcBKYknX1HTHsjF34caKrFuwruK3otM6iHQZm';

const nono = MoneroKeys.deriveFromSpendKey(spend, 'nono-mainnet');
const legacy = MoneroKeys.deriveFromSpendKey(spend, 'mainnet'); // resolves to nono in Networks

console.log('NONO id address:', nono.address);
console.log('first char:', nono.address[0]);
console.log('matches user 4-addr:', nono.address === userAddr);

// Force Monero mainnet byte 18 if we bypass networks
const ps = MoneroKeys.hexToBytes(nono.publicSpendKeyHex);
const pv = MoneroKeys.hexToBytes(nono.publicViewKeyHex);
const addr18 = MoneroKeys.encodeAddress(18, ps, pv);
const addr127 = MoneroKeys.encodeAddress(127, ps, pv);
console.log('encode 18:', addr18.slice(0, 8), 'match user:', addr18 === userAddr);
console.log('encode 127:', addr127.slice(0, 8), 'match user:', addr127 === userAddr);