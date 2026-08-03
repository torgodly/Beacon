{{-- resources/views/nginx/static.blade.php --}}
server {
    listen 80; listen [::]:80;
    server_name {{ $serverNames }};
    @include('nginx.partials.acme')
@if ($certificate)
    location / { return 301 https://{{ $site->name }}$request_uri; }
}
server {
    @if ($http2Inline) listen 443 ssl http2; listen [::]:443 ssl http2;
    @else              listen 443 ssl; listen [::]:443 ssl; http2 on; @endif
    server_name {{ $serverNames }};
    @include('nginx.partials.ssl', ['lineage' => $certificate->lineage])
@endif

    root {{ $site->path }}{{ $site->web_directory }};
    index index.html index.htm;

    add_header X-Frame-Options        "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff"    always;

    location / {
@if ($site->spa_fallback)
        try_files $uri $uri/ /index.html;
@else
        try_files $uri $uri/ =404;
@endif
    }
    location ~* \.(?:js|css|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|avif|ico)$ {
        expires 365d; add_header Cache-Control "public, immutable"; access_log off; }
    location = /index.html { add_header Cache-Control "no-cache"; }
    location ~ /\.(?!well-known).* { deny all; }

    access_log /var/log/nginx/{{ $site->name }}-access.log;
    error_log  /var/log/nginx/{{ $site->name }}-error.log error;
}
