server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name wallet.nonoprivacy.com;

    ssl_certificate /etc/letsencrypt/live/wallet.nonoprivacy.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wallet.nonoprivacy.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/wallet.nonoprivacy.com;
    index verify.html;

    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=(self)" always;
    add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' 'unsafe-eval' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://explorer.nonoprivacy.com https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; upgrade-insecure-requests" always;

    # Same-origin HTTPS proxies (browser hits /api/* on wallet host)
    location /api/rpc-nono/ {
        proxy_pass http://127.0.0.1:24701/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    location /api/proxy/ {
        proxy_pass http://127.0.0.1:24701/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    location /api/lws-nono/ {
        proxy_pass http://127.0.0.1:8470/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    location = /dashboard {
        rewrite ^ /dashboard.html last;
    }
    location = /verify {
        rewrite ^ /verify.html last;
    }

    location ^~ /js/ {
        add_header Cache-Control "public, max-age=0, must-revalidate";
        try_files $uri =404;
    }

    location ^~ /css/ {
        add_header Cache-Control "public, max-age=3600";
        try_files $uri =404;
    }

    location ^~ /assets/ {
        add_header Cache-Control "public, max-age=86400";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /verify.html;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name wallet.nonoprivacy.com;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type "text/plain";
    }

    return 301 https://$host$request_uri;
}