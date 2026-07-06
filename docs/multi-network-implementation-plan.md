# Multi-network wallet implementation plan

This document captures the exploration and implementation strategy for extending **Nono-web-wallet** (fork of Medtabka/monero-web) to support **Monero Mainnet** and **NONO Mainnet** in one minimal plain-JavaScript app, with room for more networks later.

## Goals

- Support **Monero Mainnet** and **NONO Mainnet** in a single web app.
- Keep the same seed phrase on both chains; **addresses differ** by network prefix (correct CryptoNote behavior).
- Preserve client-side cryptography and existing import paths (25-word, 13-word MyMonero, 16-word polyseed, 12-word BIP-39, spend-key import).
- Self-host friendly (defaults can point at VPS-local RPC/LWS in a later nginx pass).

## Current architecture (pre-change)

| Layer | Notes |
|--------|--------|
| **Crypto** | `monero-keys.js`, `monero-subaddress.js` — network was `'mainnet' \| 'testnet' \| 'stagenet'` with Monero-only prefix bytes |
| **UI** | `verify-page.js` largely hardcoded `'mainnet'` |
| **RPC** | `monero-rpc.js` → `/api/proxy` (Cloudflare) or per-user custom node URL |
| **LWS** | `lws-client.js` → Worker URL; balance/history/send decoys need **monero-lws** |
| **Vault** | `wallet-vault.js` stores `keys.network` |

## NONO mainnet parameters

From [hempmillionaire/nono](https://github.com/hempmillionaire/nono) `src/cryptonote_config.h` (verified on NONO VPS `/root/Nono`):

| Field | Value | Notes |
|--------|--------|--------|
| **addressPrefix** | **127** | Base58 addresses often start with **`N`** |
| **integratedPrefix** | **128** | |
| **subaddressPrefix** | **129** | Monero mainnet subaddress prefix is **42** (`8…`) |
| **P2P** | **24700** | |
| **RPC** | **24701** | |
| **NETWORK_ID** | `NONOMAIN` + genesis date bytes | Fork identity |

Future NONO testnet/stagenet (not in v1 UI): prefixes **125** / **73**, ports **248xx** / **249xx**.

## Recommended `js/networks.js` registry

Single source of truth: each entry includes `displayName`, `ticker`, prefix bytes, RPC/LWS defaults, storage keys for custom overrides.

Primary IDs:

- `monero-mainnet` — prefixes 18 / 42 / 19, RPC via `/api/proxy`, LWS via configured Worker URL
- `nono-mainnet` — prefixes **127** / **129** / **128**, RPC default placeholder for self-host (`/api/rpc-nono`), **LWS Phase 2** (`lwsAvailable: false`)

Legacy aliases: bare `'mainnet'` → `monero-mainnet`, etc.

## Implementation map

| File | Change |
|------|--------|
| `js/networks.js` | New registry + `resolve()`, `get()`, `listForUi()` |
| `js/monero-keys.js` | Prefixes from `Networks`; `networkId` on derived keys |
| `js/monero-subaddress.js` | Subaddress prefix from active network |
| `js/monero-rpc.js` | Per-network proxy path + custom node storage key |
| `js/lws-client.js` | Per-network base URL; `isAvailable()` |
| `verify.html` + `verify-page.js` | Network switcher; wire derive/create paths |
| `dashboard.html` + `dashboard-page.js` | Active network + ticker; switch re-derives from spend key; LWS unavailable banner |

## Network switch behavior

- **Full wallet** (has spend key): `deriveFromSpendKey(spend, newNetworkId)` → same keys, new address → update vault + UI, reconnect RPC, reset LWS registration.
- **Watch-only**: cannot re-derive address from seed material; user must import the address for that chain.
- **Mnemonic-only session** without spend in vault: not stored by default; spend-key path covers typical unlock flow.

## Phase 2 (out of scope for first code pass)

- **NONO LWS** on VPS (balance/history/send decoys against NONO chain).
- **nginx** on explorer VPS: CORS RPC proxy to `127.0.0.1:24701`, optional wallet static vhost.
- Turnstile / Worker URLs for self-hosted domains.

## VPS self-host defaults (later)

| Service | Suggested |
|---------|-----------|
| Explorer | `https://explorer.nonoprivacy.com` |
| NONO RPC (browser) | Same host `/api/rpc` → `127.0.0.1:24701` + CORS |
| Wallet static | `wallet.nonoprivacy.com` or path under explorer |

## Risks / notes

- Send on NONO needs RPC paths allowed on the NONO proxy (`send_raw_transaction`, `get_outs`, etc.).
- UI should state: *same seed, different addresses per network*.
- Monero checkpoint-based restore heights on verify page are Monero-specific; NONO users should use advanced height or polyseed birthday.

## Implementation order (completed on `main`)

1. `networks.js` + tests for NONO prefix → address starts with `N`.
2. Wire `monero-keys` + `monero-subaddress`.
3. Verify UI + vault `networkId`.
4. RPC/LWS respect active network.
5. Dashboard labels + switch + LWS banner when unavailable.