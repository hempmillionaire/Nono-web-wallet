# NONO browser send vs chain specs

## Compared to [hempmillionaire/Nono](https://github.com/hempmillionaire/Nono) (`src/cryptonote_config.h`)

| Parameter | NONO chain | `js/networks.js` | Vendored `MyMoneroCoreCpp_WASM` |
|-----------|------------|------------------|----------------------------------|
| Address prefix | **127** (`N…`) | ✓ 127 | Monero **18** (`4…`) unless custom build |
| Atomic decimals | **10** (`COIN = 10^10`) | ✓ 10 | Monero **12** internally |
| Genesis / tx domain | `NONO_GENESIS_STRANDED_2026` | N/A (LWS/RPC) | Monero genesis baked in |
| HF at height (live) | **16** | ✓ `hardForkVersion: 16` | Monero fork table (similar schedule) |
| `send_step1` export | N/A | manual plan fallback | **Not exported** |
| `send_step2` export | N/A | used for sign | ✓ present |
| Native send API | N/A | not wired yet | **`send_funds`** (async, preferred upstream) |

Receive/sync works because **LWS + JS key derivation** use NONO params. **Signing** runs inside WASM that was **not** compiled from the Nono tree — so `send_step2` can throw a native C++ exception (`tx_sign` / `􅂀`) even when decoys and fees look correct.

## What works today

- CLI / `nono-wallet-cli` send (daemon RPC) — built from Nono repo ✓
- Web wallet balance, history, receive, fee **estimate** ✓
- Web wallet **send** ✗ until NONO-linked `mymonero-core` WASM (or alternate signer)

## Fix path (recommended)

1. Build [mymonero-mymonero-core](https://github.com/mymonero/mymonero-core) (or MyMonero app core) with **`cryptonote_config.h` from hempmillionaire/Nono** — same as `nonod` / `monero-lws`.
2. Replace `js/mymonero-core/MyMoneroCoreCpp_WASM.js` + `.wasm`.
3. Prefer wiring **`send_funds`** + LWS callbacks (see `MyMoneroCoreBridgeClass.js` `async__send_funds`) — matches this binary’s exports.
4. Re-run send smoke on testnet/stagenet (prefix 125 / 73 in config) before mainnet amounts.

## Interim

Use **CLI** for sends; keep web wallet for watch/receive. Do not route spend keys to the server.