# UI regression checklist (visual-only releases)

After a design-system change, confirm **behavior unchanged**:

## Wallet (`wallet.nonoprivacy.com`)
- [ ] Verify: derive seed / spend key / watch-only → `N…` address
- [ ] Verify: open wallet → dashboard
- [ ] Dashboard: conn bar → synced (green dot)
- [ ] Balance + tx list (LWS)
- [ ] Send / Receive modals open
- [ ] Subaddress generate
- [ ] Settings: custom node clear + retry
- [ ] Forget session / unlock overlay

## Explorer (`explorer.nonoprivacy.com`)
- [ ] Home: block table loads
- [ ] Search: height / hash / tx
- [ ] Pagination previous/next
- [ ] Block + tx detail pages render

## Brand
- [ ] Purple = actions only; green = success/synced; yellow = pending; red = errors/delete
- [ ] No orange `#ff6600` or legacy green `#73AD21` in UI