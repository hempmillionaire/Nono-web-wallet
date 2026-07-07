#!/usr/bin/env bash
# Publish Nono-web-wallet to wallet.nonoprivacy.com (NONO VPS).
set -euo pipefail
SRC="${1:-/root/Nono-web-wallet}"
DEST="${2:-/var/www/wallet.nonoprivacy.com}"
NGINX_VHOST="${3:-/etc/nginx/sites-enabled/wallet.nonoprivacy.com}"

rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.hermes' \
  "$SRC/" "$DEST/"

# nginx/www-data must read static files (rsync as root often leaves mode 600)
find "$DEST" -type d -exec chmod 755 {} \;
find "$DEST" -type f -exec chmod 644 {} \;
chown -R www-data:www-data "$DEST"

if [[ -f "$SRC/deploy/nginx-wallet.nonoprivacy.com" ]]; then
  cp "$SRC/deploy/nginx-wallet.nonoprivacy.com" "$NGINX_VHOST"
  nginx -t
  systemctl reload nginx
fi

echo "Deployed $SRC -> $DEST"
for f in js/networks.js js/monero-keys.js js/dashboard-page.js verify.html dashboard.html; do
  code=$(curl -sk -o /dev/null -w '%{http_code}' "https://wallet.nonoprivacy.com/$f")
  echo "  https://wallet.nonoprivacy.com/$f -> HTTP $code"
done