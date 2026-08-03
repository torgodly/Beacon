{{-- resources/views/nginx/proxy.blade.php --}}
upstream beacon_{{ $site->upstreamName() }} {
    server 127.0.0.1:{{ $site->proxy_port }};
    keepalive 16;
}
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

    client_max_body_size {{ $site->client_max_body_size }};

@if ($site->type === 'nextjs')
    location /_next/static/ { alias {{ $site->path }}/.next/static/;
        expires 365d; add_header Cache-Control "public, immutable"; access_log off; }
@else
    location /_nuxt/ { alias {{ $site->path }}/.output/public/_nuxt/;
        expires 365d; add_header Cache-Control "public, immutable"; access_log off; }
@endif

    location / {
        proxy_pass http://beacon_{{ $site->upstreamName() }};
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_read_timeout 60s; proxy_connect_timeout 10s; proxy_buffering on;
    }

    access_log /var/log/nginx/{{ $site->name }}-access.log;
    error_log  /var/log/nginx/{{ $site->name }}-error.log error;
}
