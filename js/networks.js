// SPDX-License-Identifier: MIT
/**
 * networks.js — NONO mainnet configuration (v1: single network only).
 *
 * • 10 decimal places; address prefix 127, subaddress 129 (cryptonote_config.h)
 * • Default RPC: explorer nginx /api/rpc-nono → local nonod :24701
 * • Custom node URL override via Advanced settings (localStorage)
 */

const Networks = (function () {
  'use strict';

  const NETWORK_ID = 'nono-mainnet';
  const ACTIVE_KEY = 'nono-web-active-network';

  /** @type {Record<string, object>} */
  const REGISTRY = {
    'nono-mainnet': {
      id: 'nono-mainnet',
      displayName: 'NONO',
      ticker: 'NONO',
      chain: 'nono',
      nettype: 'mainnet',
      atomicDecimals: 10,
      atomicUnitLabel: 'atomic',
      addressPrefix: 127,
      subaddressPrefix: 129,
      integratedPrefix: 128,
      defaultRpcUrl: '',
      rpcProxyPath: '/api/rpc-nono',
      defaultLwsUrl: '/api/lws-nono',
      lwsAvailable: true,
      customNodeStorageKey: 'nono-web-node-url',
      lwsUrlStorageKey: 'nono-web-lws-url',
      expectedAddressHint: 'starts with N',
      rpcPort: 24701,
      p2pPort: 24700,
    },
  };

  function resolve(idOrLegacy) {
    if (!idOrLegacy || idOrLegacy === 'mainnet') return NETWORK_ID;
    if (REGISTRY[idOrLegacy]) return idOrLegacy;
    // Legacy Monero wallet blobs → treat as NONO for v1
    if (String(idOrLegacy).indexOf('monero-') === 0) return NETWORK_ID;
    throw new Error('Unknown network: ' + idOrLegacy);
  }

  function get(idOrLegacy) {
    const id = resolve(idOrLegacy);
    return REGISTRY[id];
  }

  function getAtomicDecimals(idOrLegacy) {
    return get(idOrLegacy).atomicDecimals;
  }

  function atomicMultiplier(idOrLegacy) {
    const dec = getAtomicDecimals(idOrLegacy);
    return BigInt(10) ** BigInt(dec);
  }

  function formatAtomic(atomicUnits, idOrLegacy) {
    const dec = getAtomicDecimals(idOrLegacy);
    const mul = atomicMultiplier(idOrLegacy);
    let n;
    if (typeof atomicUnits === 'bigint') n = atomicUnits;
    else if (typeof atomicUnits === 'string') n = BigInt(atomicUnits);
    else n = BigInt(Math.round(Number(atomicUnits) || 0));
    const sign = n < 0n ? '-' : '';
    if (n < 0n) n = -n;
    const whole = n / mul;
    const frac = n % mul;
    if (frac === 0n) return sign + whole.toString();
    let fracStr = frac.toString().padStart(dec, '0').replace(/0+$/, '');
    return sign + whole.toString() + '.' + fracStr;
  }

  function parseAtomic(amountString, idOrLegacy) {
    const dec = getAtomicDecimals(idOrLegacy);
    const mul = atomicMultiplier(idOrLegacy);
    const s = String(amountString).trim().replace(',', '.');
    if (!s) return 0n;
    if (!/^[0-9]+(\.[0-9]+)?$/.test(s)) {
      throw new Error('Invalid amount');
    }
    const parts = s.split('.');
    const whole = BigInt(parts[0] || '0');
    const frac = (parts[1] || '').padEnd(dec, '0').substring(0, dec);
    return whole * mul + BigInt(frac);
  }

  function getCustomRpcUrl(idOrLegacy) {
    const cfg = get(idOrLegacy);
    try {
      const v = localStorage.getItem(cfg.customNodeStorageKey);
      if (v && String(v).trim()) return String(v).trim().replace(/\/$/, '');
    } catch (e) {}
    return '';
  }

  function getEffectiveRpcUrlList(idOrLegacy) {
    const custom = getCustomRpcUrl(idOrLegacy);
    if (custom) return [custom];
    const cfg = get(idOrLegacy);
    const out = [];
    if (cfg.defaultRpcUrl && String(cfg.defaultRpcUrl).trim()) {
      out.push(String(cfg.defaultRpcUrl).trim().replace(/\/$/, ''));
    }
    return out;
  }

  function getEffectiveRpcUrl(idOrLegacy) {
    const list = getEffectiveRpcUrlList(idOrLegacy);
    return list.length ? list[0] : '';
  }

  function listForUi() {
    return [{ id: NETWORK_ID, displayName: 'NONO Mainnet' }];
  }

  function getActiveId() {
    try {
      const raw = localStorage.getItem(ACTIVE_KEY);
      if (raw && REGISTRY[raw]) return raw;
    } catch (e) {}
    return NETWORK_ID;
  }

  function setActiveId(idOrLegacy) {
    const id = resolve(idOrLegacy);
    try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) {}
    applyToClients(id);
    return get(id);
  }

  function applyToClients(networkId) {
    const cfg = get(networkId);
    if (typeof MoneroRPC !== 'undefined' && MoneroRPC.setActiveNetwork) {
      MoneroRPC.setActiveNetwork(cfg.id);
    }
    if (typeof LwsClient !== 'undefined' && LwsClient.setActiveNetwork) {
      LwsClient.setActiveNetwork(cfg.id);
    }
  }

  function getAddressPrefix(idOrLegacy) {
    return get(idOrLegacy).addressPrefix;
  }

  function getSubaddressPrefix(idOrLegacy) {
    return get(idOrLegacy).subaddressPrefix;
  }

  function formatTickerAmount(atomic, idOrLegacy) {
    const id = resolve(idOrLegacy || getActiveId());
    return formatAtomic(atomic, id) + ' ' + get(id).ticker;
  }

  return {
    NETWORK_ID,
    REGISTRY,
    resolve,
    get,
    getAtomicDecimals,
    atomicMultiplier,
    formatAtomic,
    parseAtomic,
    getCustomRpcUrl,
    getEffectiveRpcUrl,
    getEffectiveRpcUrlList,
    listForUi,
    getActiveId,
    setActiveId,
    applyToClients,
    getAddressPrefix,
    getSubaddressPrefix,
    formatTickerAmount,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Networks;