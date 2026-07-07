# NONO web wallet — deployment contract

Fork baseline: [Medtabka/monero-web](https://github.com/Medtabka/monero-web). NONO v1 keeps the same **browser crypto + RPC proxy + LWS** shape; only chain parameters and hosted backends change.

## Chain parameters (must match `/root/Nono/src/cryptonote_config.h`)

| Field | Value |
|--------|--------|
| Address prefix | **127** (Base58 addresses start with **`N`**) |
| Subaddress prefix | **129** (`NS…`) |
| Atomic decimals | **10** |
| RPC (daemon) | **127.0.0.1:24701** (`nonod`) |
| LWS (light wallet) | **127.0.0.1:8470** (`monero-lws` / `nono-lws`) |

Same seed → same scalar keys; **address string differs** from Monero (prefix 18 / `4…`).

## Browser-facing URLs (wallet host)

Served from `https://wallet.nonoprivacy.com` (static root `/var/www/wallet.nonoprivacy.com`).

| Purpose | Browser path | Origin proxy target |
|---------|----------------|---------------------|
| JSON-RPC | `POST /api/rpc-nono/json_rpc` | `http://127.0.0.1:24701/json_rpc` |
| LWS REST | `POST /api/lws-nono/<endpoint>` | `http://127.0.0.1:8470/<endpoint>` |

`js/networks.js` is the single source of truth (`rpcProxyPath`, `defaultLwsUrl`). **If this file is not readable (HTTP 403), the app falls back to Monero netbyte `4…` addresses and wrong endpoints.**

## Required client scripts (load order)

1. `js/networks.js` — **before** `monero-keys.js`, `monero-rpc.js`, `lws-client.js`
2. `js/monero-keys.js` — uses `Networks.getAddressPrefix()`; `normalizeForNetwork()` for legacy `4…` vaults
3. `verify-page.nono.js` on `verify.html` (not legacy `verify-page.js` alone)

## Upstream vs NONO (what we replaced)

| Medtabka monero-web | NONO self-host |
|---------------------|----------------|
| Cloudflare `/api/proxy` | Same-origin `/api/rpc-nono` |
| `node.monero-web.com` LWS + Turnstile | `/api/lws-nono` direct LWS (Turnstile skipped) |
| Prefix 18 | Prefix 127 |
| 12 atomic decimals | 10 atomic decimals |

## Publish (NONO VPS)

```bash
sudo bash /root/Nono-web-wallet/deploy/publish-wallet-vps.sh
```

Checks public HTTP 200 for `js/networks.js` and core bundles.

## Explorer reference

`onion-nono-blockchain-explorer` (`nonoblocks`) uses `daemon-url` → **24701** for height/blocks — same daemon as wallet RPC proxy.

## LWS login rule

LWS rejects Monero-encoded primary addresses (`4…`). Wallet must register **`N…`** address + view key for balance/history automation.