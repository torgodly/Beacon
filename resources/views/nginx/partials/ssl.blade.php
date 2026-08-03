{{-- resources/views/nginx/partials/ssl.blade.php --}}
ssl_certificate     /etc/letsencrypt/live/{{ $lineage }}/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/{{ $lineage }}/privkey.pem;
ssl_trusted_certificate /etc/letsencrypt/live/{{ $lineage }}/chain.pem;
include /etc/letsencrypt/options-ssl-nginx.conf;
ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
add_header Strict-Transport-Security "max-age=31536000" always;
