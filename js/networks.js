// SPDX-License-Identifier: MIT
/**
 * networks.js — centralized chain / network configuration
 *
 * Each network entry defines address encoding prefixes, RPC/LWS endpoints,
 * and UI metadata. Add new networks by extending REGISTRY below.
 *
 * Public API:
 *   Networks.resolve(idOrLegacy)  → canonical network id
 *   Networks.get(id)                → config object (throws if unknown)
 *   Networks.listForUi()            → [{ id, displayName }] for switchers
 *   Networks.getActiveId()          → persisted user choice
 *   Networks.setActiveId(id)        → persist + return config
 *   Networks.applyToClients()       → push RPC/LWS settings for active network
 */

const Networks = (function () {
  'use strict';

  const ACTIVE_KEY = 'monero-web-active-network';

  /** @type {Record<string, object>} */
  const REGISTRY = {
    'monero-mainnet': {
      id: 'monero-mainnet',
      displayName: 'Monero',
      ticker: 'XMR',
      chain: 'monero',
      nettype: 'mainnet',
      addressPrefix: 18,
      subaddressPrefix: 42,
      integratedPrefix: 19,
      // Empty string = use built-in proxy path in monero-rpc.js
      defaultRpcUrl: '',
      rpcProxyPath: '/api/proxy',
      defaultLwsUrl: 'https://monero-proxy.rosawands4.workers.dev/lws',
      lwsAvailable: true,
      customNodeStorageKey: 'monero-web-node-url:monero-mainnet',
      lwsUrlStorageKey: 'monero-web-lws-url:monero-mainnet',
      expectedAddressHint: 'starts with 4',
    },
    'monero-testnet': {
      id: 'monero-testnet',
      displayName: 'Monero Testnet',
      ticker: 'XMR',
      chain: 'monero',
      nettype: 'testnet',
      addressPrefix: 53,
      subaddressPrefix: 63,
      integratedPrefix: 54,
      defaultRpcUrl: '',
      rpcProxyPath: '/api/proxy',
      defaultLwsUrl: '',
      lwsAvailable: false,
      customNodeStorageKey: 'monero-web-node-url:monero-testnet',
      lwsUrlStorageKey: 'monero-web-lws-url:monero-testnet',
      expectedAddressHint: 'starts with 9 or A',
    },
    'monero-stagenet': {
      id: 'monero-stagenet',
      displayName: 'Monero Stagenet',
      ticker: 'XMR',
      chain: 'monero',
      nettype: 'stagenet',
      addressPrefix: 24,
      subaddressPrefix: 36,
      integratedPrefix: 25,
      defaultRpcUrl: '',
      rpcProxyPath: '/api/proxy',
      defaultLwsUrl: '',
      lwsAvailable: false,
      customNodeStorageKey: 'monero-web-node-url:monero-stagenet',
      lwsUrlStorageKey: 'monero-web-lws-url:monero-stagenet',
      expectedAddressHint: 'starts with 5',
    },
    'nono-mainnet': {
      id: 'nono-mainnet',
      displayName: 'NONO',
      ticker: 'NONO',
      chain: 'nono',
      nettype: 'mainnet',
      // From nono/src/cryptonote_config.h — CRYPTONOTE_PUBLIC_ADDRESS_BASE58_PREFIX
      addressPrefix: 127,
      subaddressPrefix: 129,
      integratedPrefix: 128,
      // Self-host default (nginx /api/rpc-nono → 127.0.0.1:24701) — wired in a later VPS pass.
      defaultRpcUrl: '',
      rpcProxyPath: '/api/rpc-nono',
      defaultLwsUrl: '',
      lwsAvailable: false,
      customNodeStorageKey: 'monero-web-node-url:nono-mainnet',
      lwsUrlStorageKey: 'monero-web-lws-url:nono-mainnet',
      expectedAddressHint: 'starts with N',
      rpcPort: 24701,
      p2pPort: 24700,
    },
  };

  // Legacy nettype strings used by older code paths and tests.
  const LEGACY_MAP = {
    mainnet: 'monero-mainnet',
    testnet: 'monero-testnet',
    stagenet: 'monero-stagenet',
  };

  function resolve(idOrLegacy) {
    if (!idOrLegacy) return 'monero-mainnet';
    if (REGISTRY[idOrLegacy]) return idOrLegacy;
    if (LEGACY_MAP[idOrLegacy]) return LEGACY_MAP[idOrLegacy];
    throw new Error('Unknown network: ' + idOrLegacy);
  }

  function get(idOrLegacy) {
    const id = resolve(idOrLegacy);
    const cfg = REGISTRY[id];
    if (!cfg) throw new Error('Unknown network: ' + idOrLegacy);
    return cfg;
  }

  /** Networks shown in the primary UI switcher (Monero + NONO mainnet). */
  function listForUi() {
    return [
      { id: 'monero-mainnet', displayName: 'Monero Mainnet' },
      { id: 'nono-mainnet', displayName: 'NONO Mainnet' },
    ];
  }

  function getActiveId() {
    try {
      const raw = localStorage.getItem(ACTIVE_KEY);
      if (raw && REGISTRY[raw]) return raw;
    } catch (e) {}
    return 'monero-mainnet';
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
    const ticker = get(idOrLegacy).ticker;
    if (typeof MoneroRPC !== 'undefined' && MoneroRPC.formatXMR) {
      return MoneroRPC.formatXMR(atomic) + ' ' + ticker;
    }
    return String(atomic) + ' ' + ticker;
  }

  return {
    REGISTRY,
    resolve,
    get,
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