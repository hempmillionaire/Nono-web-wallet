# NONO Ecosystem UI Refresh

**Status:** Planning — UI/UX only (no logic changes)  
**Reference:** [nono.social](https://nono.social)  
**Applies to:** NONO Wallet (`wallet.nonoprivacy.com`), NONO Explorer (`explorer.nonoprivacy.com`), and related surfaces that should feel like one product.

---

## Goal

Update the visual design of the **NONO Wallet** and **NONO Explorer** so they match the official NONO branding used on **NONO Social**.

This is a **UI/UX refresh only**.

## Out of scope (do not modify)

- Wallet functionality (derive, vault, send, receive, LWS, etc.)
- Blockchain logic, consensus, cryptography, security
- Explorer indexing, transaction handling, search behavior
- RPC / LWS / API communication and backend architecture
- Application behavior and data flows

**Only** improve appearance while preserving all existing functionality.

The end result should feel like **one premium, privacy-focused NONO ecosystem**.

---

## Design direction

| Attribute | Target |
|-----------|--------|
| Tone | Premium, modern, privacy-first, minimal, sophisticated |
| Mode | Dark |
| Feel | Fast, professional |
| Motif | Cyber-inspired **without** looking cheesy |
| Effects | Glassmorphism where appropriate |
| Light | **Soft purple** lighting — not bright neon |

**Inspiration (mood, not copy):** Apple · Proton · Linear · Arc Browser · Cloudflare  

**Avoid:** Generic crypto wallet / blockchain explorer aesthetics.

---

## Official NONO color palette

| Role | Value |
|------|--------|
| Background | `#08070D` |
| Surface | `#11101A` |
| Elevated surface | `#171323` |
| Primary purple | `#745BC6` |
| Secondary purple | `#5B4A8E` |
| Highlight purple | `#BFAEFF` |
| Primary text | `#FFFFFF` |
| Secondary text | `#A8A8B8` |
| Muted text | `#6E6E80` |
| Primary border | `rgba(191,174,255,0.15)` |
| Subtle border | `rgba(191,174,255,0.08)` |
| Primary glow | `rgba(116,91,198,0.40)` |
| Soft glow | `rgba(191,174,255,0.25)` |
| Primary hover | `#8A72D8` |
| Secondary hover | `#6A54B8` |

### Brand gradient

```css
linear-gradient(
  135deg,
  #5B4A8E 0%,
  #745BC6 45%,
  #BFAEFF 100%
)
```

### Background accent

```css
radial-gradient(
  circle,
  rgba(116,91,198,.18) 0%,
  rgba(116,91,198,.06) 45%,
  transparent 100%
)
```

---

## Design language

**Use consistently:**

- Rounded corners  
- Glassmorphism cards  
- Soft shadows  
- Purple accent borders  
- Subtle purple glow  
- Modern typography  
- Strong visual hierarchy  
- Clean spacing  
- Smooth hover animations  
- Minimal transitions  
- Purple focus rings  
- Purple loading indicators  
- Purple progress bars  
- Purple selected states  
- Clean tables  
- Elegant cards  

**Surfaces to align:**

| Wallet | Explorer |
|--------|----------|
| Dashboard | Homepage |
| Send / Receive | Latest blocks |
| Transaction history | Transactions |
| QR screens | Search |
| Settings | Address pages |
| Verify / unlock | Charts |
| Navigation (all) | Tables |

---

## Success criteria

- Wallet and Explorer read as the **same brand** as NONO Social at a glance.  
- No regressions in wallet or explorer **functionality** (manual QA checklist per release).  
- Accessible contrast on primary text and interactive controls (spot-check WCAG on key screens).  
- Mobile layouts remain usable (wallet already targets phone-first Discord users).

---

## Suggested implementation order (when approved)

1. **Design tokens** — single `:root` token file (colors, radii, shadows, motion).  
2. **Shared typography** — one font stack aligned with Social (if public).  
3. **Shell** — nav, footer, ambient background, cards.  
4. **Wallet** — verify → dashboard → modals.  
5. **Explorer** — home → block/tx/address templates.  
6. **Polish** — loading states, empty states, error banners.

---

## Ownership & repos

| Product | Repo (indicative) |
|---------|-------------------|
| Wallet | [hempmillionaire/Nono-web-wallet](https://github.com/hempmillionaire/Nono-web-wallet) |
| Explorer | `onion-nono-blockchain-explorer` (deployed explorer host) |
| Reference | [nono.social](https://nono.social) |

---

*Document version: 2026-07-07 — for sharing with designers, contributors, and AI implementation briefs.*