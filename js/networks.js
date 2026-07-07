// SPDX-License-Identifier: MIT
/**
 * networks.js — centralized chain / network configuration
 *
 * Two production networks in the UI:
 *   • Monero mainnet — 12 decimal places (piconero); default RPC is a **public**
 *     remote node (we do not run our own Monero daemon — disk). Users can override
 *     `defaultRpcUrl` via Advanced settings (custom node URL in localStorage).
 *   • NONO mainnet — **10** decimal places; address prefix **127**, subaddress **129**.
 *     Default RPC points at our explorer origin (nginx `/api/rpc` proxy added later).
 *
 * Light-wallet (LWS): optional per network. Empty `defaultLwsUrl` = no balance/history
 * scan until the user configures a URL or we deploy LWS.
 *
 * Public API:
 *   Networks.resolve(idOrLegacy)
 *   Networks.get(id)
 *   Networks.getAtomicDecimals(id)
 *   Networks.formatAtomic(atomicUnits, idOrLegacy)
 *   Networks.parseAtomic(amountString, idOrLegacy)
 *   Networks.getEffectiveRpcUrl(idOrLegacy)  — custom override wins, then defaultRpcUrl
 *   Networks.listForUi()
 *   Networks.getActiveId() / setActiveId(id)
 *   Networks.applyToClients()
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
      // Monero uses 12 fractional digits (1 XMR = 1e12 atomic units).
      atomicDecimals: 12,
      atomicUnitLabel: 'piconero',
      addressPrefix: 18,
      subaddressPrefix: 42,
      integratedPrefix: 19,
      // Public remote node — not operated by us. Override in UI for privacy (custom node).
      defaultRpcUrl: 'https://node.moneroworld.com:18089',
      // Fallback when defaultRpcUrl is cleared and no custom node (legacy hosted proxy).
      rpcProxyPath: '/api/proxy',
      defaultLwsUrl: '',
      lwsAvailable: false,
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
      atomicDecimals: 12,
      atomicUnitLabel: 'piconero',
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
      atomicDecimals: 12,
      atomicUnitLabel: 'piconero',
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
      // NONO uses 10 fractional digits (not Monero's 12).
      atomicDecimals: 10,
      atomicUnitLabel: 'atomic',
      // nono/src/cryptonote_config.h
      addressPrefix: 127,
      subaddressPrefix: 129,
      integratedPrefix: 128,
      // NONO mainnet RPC (hostnames only — no raw VPS IPs in the wallet):
      // 1) This VPS — nonod via nginx /api/rpc-nono → 127.0.0.1:24701
      // 2) Genesis launch strand seed — public RPC on seed.nonoprivacy.com (DNS → launch node)
      defaultRpcUrl: 'https://explorer.nonoprivacy.com/api/rpc-nono',
      fallbackRpcUrls: [
        'https://seed.nonoprivacy.com:24701',
      ],
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

  function getAtomicDecimals(idOrLegacy) {
    const cfg = get(idOrLegacy);
    return typeof cfg.atomicDecimals === 'number' ? cfg.atomicDecimals : 12;
  }

  function atomicMultiplier(idOrLegacy) {
    const dec = getAtomicDecimals(idOrLegacy);
    return BigInt(10) ** BigInt(dec);
  }

  /**
   * Format on-chain atomic units to a human amount string (no trailing zeros).
   */
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

  /**
   * Parse a decimal amount string into atomic units (BigInt).
   */
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

  /** Custom node URL from localStorage, if set. */
  function getCustomRpcUrl(idOrLegacy) {
    const cfg = get(idOrLegacy);
    try {
      const v = localStorage.getItem(cfg.customNodeStorageKey);
      if (v && String(v).trim()) return String(v).trim().replace(/\/$/, '');
    } catch (e) {}
    return '';
  }

  /**
   * Ordered RPC bases: custom override, then defaultRpcUrl, then fallbackRpcUrls.
   */
  function getEffectiveRpcUrlList(idOrLegacy) {
    const custom = getCustomRpcUrl(idOrLegacy);
    if (custom) return [custom];
    const cfg = get(idOrLegacy);
    const out = [];
    if (cfg.defaultRpcUrl && String(cfg.defaultRpcUrl).trim()) {
      out.push(String(cfg.defaultRpcUrl).trim().replace(/\/$/, ''));
    }
    const fallbacks = cfg.fallbackRpcUrls;
    if (Array.isArray(fallbacks)) {
      for (const u of fallbacks) {
        if (u && String(u).trim()) {
          const norm = String(u).trim().replace(/\/$/, '');
          if (!out.includes(norm)) out.push(norm);
        }
      }
    }
    return out;
  }

  /**
   * RPC base URL for JSON-RPC: first entry from getEffectiveRpcUrlList, or ''.
   */
  function getEffectiveRpcUrl(idOrLegacy) {
    const list = getEffectiveRpcUrlList(idOrLegacy);
    return list.length ? list[0] : '';
  }

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
    const id = resolve(idOrLegacy || getActiveId());
    return formatAtomic(atomic, id) + ' ' + get(id).ticker;
  }

  return {
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