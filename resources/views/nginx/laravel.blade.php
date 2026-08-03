{{-- resources/views/nginx/laravel.blade.php --}}
# ─── Managed by Beacon — site: {{ $site->name }} ───
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
    index index.php index.html;
    charset utf-8;

    add_header X-Frame-Options        "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff"    always;
    add_header Referrer-Policy        "strict-origin-when-cross-origin" always;

    client_max_body_size {{ $site->client_max_body_size }};

@foreach ($redirects as $redirect)
    if ($host = '{{ $redirect->domain }}') {
        return {{ $redirect->redirect_status_code ?? 301 }} $scheme://{{ $redirect->redirect_to }}$request_uri;
    }
@endforeach

    location / { try_files $uri $uri/ /index.php?$query_string; }
    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }
    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php{{ $site->php_version }}-fpm-{{ $site->poolName() }}.sock;
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT   $realpath_root;
        fastcgi_hide_header X-Powered-By;
        fastcgi_read_timeout 60;
        fastcgi_buffers 16 16k;
        fastcgi_buffer_size 32k;
    }

    location ~ /\.(?!well-known).* { deny all; }

    access_log /var/log/nginx/{{ $site->name }}-access.log;
    error_log  /var/log/nginx/{{ $site->name }}-error.log error;
}
