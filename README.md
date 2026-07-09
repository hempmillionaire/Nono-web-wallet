# NONO Web Wallet

**Open-source, non-custodial NONO wallet in your browser. Keys never leave your device.**

Live: [wallet.nonoprivacy.com](https://wallet.nonoprivacy.com) · Chain explorer: [explorer.nonoprivacy.com](https://explorer.nonoprivacy.com)

Fork of [Medtabka/monero-web](https://github.com/Medtabka/monero-web), adapted for the **NONO** privacy chain (CryptoNote fork, mainnet address prefix **`N`**, netbyte **127**).

## What it does

Browser-only wallet — no app install. Create or restore from seed, spend key, or watch-only; send and receive; subaddresses; encrypted session vault.

- **Seed formats:** 25-word standard, 13-word MyMonero legacy, 16-word Polyseed, 12-word BIP-39 (13 languages)
- **Network:** NONO mainnet only (v1) — height, fees, pool via same-origin RPC proxy
- **Balance & history:** [monero-lws](https://github.com/vtnerd/monero-lws) via `/api/lws-nono`
- **Send:** Client-side signing (mymonero-core WASM path where enabled)
- **No npm build** for core crypto — hand-written JS modules

## Architecture (self-hosted)

```
Browser (client-side)
├── js/networks.js       — NONO chain params, proxy paths
├── js/monero-keys.js    — Derivation (prefix 127 → N… addresses)
├── js/monero-rpc.js     — JSON-RPC → /api/rpc-nono
├── js/lws-client.js     — Light wallet REST → /api/lws-nono
├── js/wallet-vault.js   — AES-GCM session storage
└── … wordlists, send, QR, etc.

wallet.nonoprivacy.com (nginx on NONO VPS)
├── /api/rpc-nono/  → nonod :24701
├── /api/lws-nono/  → monero-lws :8470
└── static files from /var/www/wallet.nonoprivacy.com
```

Deployment contract: see **[docs/NONO-DEPLOYMENT.md](docs/NONO-DEPLOYMENT.md)**.

### Address format

Same key material as Monero-family wallets, but NONO mainnet uses **network byte 127** — displayed addresses start with **`N`**, not `4`. LWS and explorers expect the NONO encoding.

## Security

- Cryptography runs **only in the browser**; spend key is not sent to the server.
- Optional **session password** encrypts keys in `sessionStorage`.
- RPC/LWS proxies see **view key** (for scan) and **public** chain queries — not your seed or spend key.
- Use a clean browser profile for large amounts; browser extensions and compromised hosts are out of scope.

## Self-hosting

```bash
git clone https://github.com/hempmillionaire/Nono-web-wallet.git
cd Nono-web-wallet
# Static files + nginx proxies to your nonod + monero-lws (see deploy/)
sudo bash deploy/publish-wallet-vps.sh   # on the wallet VPS
```

Local static preview (RPC/LWS need proxies or won’t connect):

```bash
python3 -m http.server 8000
# http://localhost:8000/verify.html
```

## Tests

```bash
node tests/test-new-paths.js
```

Covers BIP-39, Polyseed, subaddresses, NONO network prefix, vault round-trip, address normalization.

## Roadmap (NONO)

- [x] NONO mainnet branding & `networks.js`
- [x] Nginx RPC/LWS proxies on wallet host
- [x] Address normalization (Monero-style `4…` → `N…`)
- [ ] README/screenshots refresh for NONO social card
- [ ] **NONO-native mymonero-core WASM** for browser send ([docs/NONO-WASM-SEND.md](docs/NONO-WASM-SEND.md))

## Contributing

PRs welcome. Keep crypto paths dependency-free and auditable.

## License

MIT

## Support the project

Donations (NONO / project addresses) — add here when you want a public tip address on README.