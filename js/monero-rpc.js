// SPDX-License-Identifier: MIT
/**
 * monero-rpc.js
 * Monero Remote Node JSON-RPC Client
 *
 * Connects to Monero remote nodes from the browser via fetch().
 * Supports automatic failover between multiple nodes.
 *
 * RPC Methods implemented:
 *   - get_info: node status, height, network info
 *   - get_height: current blockchain height
 *   - get_fee_estimate: estimated fee per byte
 *   - send_raw_transaction: broadcast a signed tx
 *   - get_outs: get output details for key images
 *
 * Depends on: nothing (standalone module)
 */

const MoneroRPC = (function () {
  'use strict';

  // Same-origin RPC proxy. Both Cloudflare Pages Functions and Netlify
  // Functions are wired up:
  //   • Cloudflare:  functions/api/proxy.js → /api/proxy
  //   • Netlify:     netlify/functions/node-proxy.js → /.netlify/functions/node-proxy
  // We pick one based on the deployment host so the same JS works on either.
  // (Cloudflare is the primary; Netlify is kept as a fallback for now.)
  // Picked per active network from js/networks.js (see setActiveNetwork).
  let PROXY_URL = '/api/proxy';
  // Per-network localStorage key for optional user-supplied direct node URL.
  let CUSTOM_NODE_KEY = 'nono-web-node-url';
  let activeNetworkId = 'nono-mainnet';

  let pinnedRpcBase = '';

  function setActiveNetwork(networkIdOrLegacy) {
    if (typeof Networks === 'undefined') return;
    const cfg = Networks.get(networkIdOrLegacy);
    activeNetworkId = cfg.id;
    PROXY_URL = cfg.rpcProxyPath || '/api/rpc-nono';
    CUSTOM_NODE_KEY = cfg.customNodeStorageKey || 'nono-web-node-url';
    pinnedRpcBase = '';
    currentNode = null;
  }

  function getActiveNetworkId() {
    return activeNetworkId;
  }

  function getCustomNode() {
    try { return localStorage.getItem(CUSTOM_NODE_KEY) || ''; } catch (e) { return ''; }
  }

  /**
   * Direct node base URL: custom override, then Networks.defaultRpcUrl, else '' → use PROXY_URL.
   */
  function getRpcBase() {
    const custom = getCustomNode();
    if (custom) return custom.replace(/\/$/, '');
    if (pinnedRpcBase) return pinnedRpcBase;
    if (typeof Networks !== 'undefined') {
      const eff = Networks.getEffectiveRpcUrl(activeNetworkId);
      if (eff) return eff;
    }
    return '';
  }

  async function jsonRpcToBase(base, method, params) {
    const url = base
      ? base + '/json_rpc'
      : PROXY_URL + '?path=/json_rpc';
    const body = { jsonrpc: '2.0', id: '0', method: method };
    if (params) body.params = params;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        throw new Error(`Proxy HTTP error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`);
      }
      return data.result;
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }
  function setCustomNode(url) {
    try {
      if (url) localStorage.setItem(CUSTOM_NODE_KEY, url.replace(/\/$/, ''));
      else     localStorage.removeItem(CUSTOM_NODE_KEY);
    } catch (e) {}
    currentNode = null;
  }

  // Default nodes (used by proxy server-side, listed here for reference)
  const DEFAULT_NODES = [
    { url: 'proxy', name: 'monero-web proxy', cors: true },
  ];

  let currentNode = null;
  let nodes = [...DEFAULT_NODES];
  let connectionListeners = [];

  /**
   * Set custom node list
   */
  function setNodes(nodeList) {
    nodes = nodeList.map(n => {
      if (typeof n === 'string') return { url: n, name: n, cors: true };
      return n;
    });
    currentNode = null;
  }

  /**
   * Add a connection state listener
   */
  function onConnectionChange(fn) {
    connectionListeners.push(fn);
  }

  function notifyListeners(state) {
    connectionListeners.forEach(fn => {
      try { fn(state); } catch(e) { console.error('[rpc] listener error:', e); }
    });
  }

  /**
   * Core JSON-RPC call via proxy
   */
  async function jsonRpc(method, params, nodeUrl) {
    const base = getRpcBase();
    return jsonRpcToBase(base, method, params);
  }

  /**
   * Core call to non-JSON-RPC endpoints (like /send_raw_transaction)
   */
  async function rpcOther(path, params, nodeUrl) {
    const base = getRpcBase();
    const url = base
      ? base + path
      : PROXY_URL + '?path=' + encodeURIComponent(path);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params || {}),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Proxy HTTP error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch(e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') throw new Error('Request timed out');
      throw e;
    }
  }

  /**
   * Test a node's connectivity and response time
   * Returns { ok, latency, height, version } or { ok: false, error }
   */
  async function testNode(nodeUrl) {
    const start = Date.now();
    try {
      const info = await jsonRpc('get_info', {}, nodeUrl);
      const latency = Date.now() - start;
      return {
        ok: true,
        latency,
        height: info.height,
        version: info.version,
        network: info.nettype || (info.mainnet ? 'mainnet' : info.testnet ? 'testnet' : 'stagenet'),
        synced: !info.busy_syncing,
        difficulty: info.difficulty,
        txCount: info.tx_count,
        txPoolSize: info.tx_pool_size,
      };
    } catch (e) {
      return { ok: false, error: e.message, latency: Date.now() - start };
    }
  }

  /**
   * Connect via proxy — tests that the proxy and backend nodes are reachable
   */
  async function connect() {
    const netLabel = (typeof Networks !== 'undefined')
      ? Networks.get(activeNetworkId).displayName
      : 'Monero';
    notifyListeners({ status: 'connecting', message: 'Connecting to ' + netLabel + ' network...' });

    try {
      const start = Date.now();
      const bases = (typeof Networks !== 'undefined')
        ? Networks.getEffectiveRpcUrlList(activeNetworkId)
        : [];
      const tryBases = bases.length ? bases : [''];
      let info = null;
      let usedBase = '';
      let lastErr = null;
      for (const base of tryBases) {
        try {
          info = await jsonRpcToBase(base, 'get_info');
          usedBase = base;
          pinnedRpcBase = base;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!info) throw lastErr || new Error('No RPC reachable');
      const latency = Date.now() - start;

      currentNode = {
        name: (typeof Networks !== 'undefined')
          ? (Networks.get(activeNetworkId).displayName + ' RPC')
          : 'monero-web proxy',
        url: usedBase || PROXY_URL,
        ok: true,
        latency,
        height: info.height,
        version: info.version,
        synced: !info.busy_syncing,
        txPoolSize: info.tx_pool_size,
        difficulty: info.difficulty,
        txCount: info.tx_count,
      };

      notifyListeners({
        status: 'connected',
        node: currentNode.name,
        url: currentNode.url,
        height: currentNode.height,
        latency: currentNode.latency,
        version: currentNode.version,
      });

      console.log(`[rpc] Connected via proxy (${latency}ms, height ${currentNode.height})`);
      return currentNode;

    } catch(e) {
      currentNode = null;
      notifyListeners({ status: 'disconnected', message: 'No nodes reachable: ' + e.message });
      throw new Error('Could not connect to network: ' + e.message);
    }
  }

  /**
   * Get node info
   */
  async function getInfo() {
    return await jsonRpc('get_info');
  }

  /**
   * Get current blockchain height
   */
  async function getHeight() {
    const result = await jsonRpc('get_block_count');
    return result.count;
  }

  /**
   * Get estimated fee per byte
   */
  async function getFeeEstimate() {
    const result = await jsonRpc('get_fee_estimate');
    return {
      feePerByte: result.fee,
      quantizationMask: result.quantization_mask,
    };
  }

  /**
   * Get outputs by index (needed for constructing transactions)
   */
  async function getOuts(outputs) {
    return await rpcOther('/get_outs', {
      outputs: outputs,
      get_txid: true,
    });
  }

  /**
   * Get transactions by hash
   */
  async function getTransactions(txHashes) {
    return await rpcOther('/get_transactions', {
      txs_hashes: txHashes,
      decode_as_json: true,
    });
  }

  /**
   * Broadcast a signed transaction
   */
  async function sendRawTransaction(txHex) {
    const result = await rpcOther('/send_raw_transaction', {
      tx_as_hex: txHex,
      do_not_relay: false,
    });

    if (result.status !== 'OK') {
      throw new Error(`Broadcast failed: ${result.reason || result.status}`);
    }

    return result;
  }

  /**
   * Get the current connection state
   */
  function getConnectionState() {
    if (!currentNode) return { status: 'disconnected' };
    return {
      status: 'connected',
      node: currentNode.name,
      url: currentNode.url,
      height: currentNode.height,
    };
  }

  /**
   * Disconnect from current node
   */
  function disconnect() {
    currentNode = null;
    notifyListeners({ status: 'disconnected', message: 'Disconnected' });
  }

  /**
   * Format atomic units for display (decimals from active network via Networks).
   */
  function formatXMR(atomicUnits, networkId) {
    const id = networkId || activeNetworkId;
    if (typeof Networks !== 'undefined') {
      return Networks.formatAtomic(atomicUnits, id);
    }
    if (typeof atomicUnits === 'string') atomicUnits = BigInt(atomicUnits);
    if (typeof atomicUnits === 'number') atomicUnits = BigInt(Math.round(atomicUnits));
    const xmr = Number(atomicUnits) / 1e12;
    return xmr.toFixed(12).replace(/\.?0+$/, '');
  }

  /**
   * Parse display amount to atomic units (decimals from active network).
   */
  function parseXMR(xmrString, networkId) {
    const id = networkId || activeNetworkId;
    if (typeof Networks !== 'undefined') {
      return Networks.parseAtomic(xmrString, id);
    }
    const parts = xmrString.split('.');
    const whole = BigInt(parts[0] || '0');
    const frac = (parts[1] || '').padEnd(12, '0').substring(0, 12);
    return whole * BigInt(1e12) + BigInt(frac);
  }

  return {
    setNodes,
    getCustomNode,
    setCustomNode,
    setActiveNetwork,
    getActiveNetworkId,
    connect,
    disconnect,
    testNode,
    getInfo,
    getHeight,
    getFeeEstimate,
    getOuts,
    getTransactions,
    sendRawTransaction,
    getConnectionState,
    onConnectionChange,
    formatXMR,
    parseXMR,
    jsonRpc,
    rpcOther,
    DEFAULT_NODES,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MoneroRPC;
