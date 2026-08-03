# Managed by Beacon — panel vhost with TLS.
server {
    listen 80;
    listen [::]:80;
    server_name {{ $domain }};

    location ^~ /.well-known/acme-challenge/ {
        root {{ $acmeWebroot }};
        default_type "text/plain";
        allow all;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
{{-- $http2Inline is TRUE for nginx < 1.25.1, which only understands the
     inline `listen … http2` form; the standalone `http2 on;` directive was
     added in 1.25.1. Emitting the wrong one makes nginx refuse the config
     with `unknown directive "http2"`. --}}
@if ($http2Inline)
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
@else
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
@endif
    server_name {{ $domain }};

    ssl_certificate     /etc/letsencrypt/live/{{ $domain }}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{{ $domain }}/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/{{ $domain }}/chain.pem;
    {{-- TLS policy is set once at http level in conf.d/beacon-global.conf.
         options-ssl-nginx.conf and ssl-dhparams.pem belong to
         python3-certbot-nginx, which Beacon does not install. --}}
    add_header Strict-Transport-Security "max-age=31536000" always;

    root {{ $panelRoot }}/public;
    index index.php index.html;
    charset utf-8;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }
    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php{{ $panelPhp }}-fpm-beacon-panel.sock;
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT $realpath_root;
        fastcgi_hide_header X-Powered-By;
        fastcgi_read_timeout 120;
        fastcgi_buffers 16 16k;
        fastcgi_buffer_size 32k;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }

    access_log /var/log/nginx/beacon-panel-access.log;
    error_log  /var/log/nginx/beacon-panel-error.log error;
}
