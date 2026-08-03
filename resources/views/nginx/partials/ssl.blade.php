{{-- resources/views/nginx/partials/ssl.blade.php

     Certificate paths only. The TLS *policy* — protocols, ciphers, session
     handling — lives once at http level in conf.d/beacon-global.conf and is
     inherited by every server block.

     This deliberately does NOT include /etc/letsencrypt/options-ssl-nginx.conf
     or reference ssl-dhparams.pem: both ship with python3-certbot-nginx, which
     Beacon does not install because certificates are obtained with
     `certonly --webroot` so certbot never edits nginx config. Referencing them
     fails the config outright with
       open() "/etc/letsencrypt/options-ssl-nginx.conf" failed (2: No such file) --}}
ssl_certificate     /etc/letsencrypt/live/{{ $lineage }}/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/{{ $lineage }}/privkey.pem;
ssl_trusted_certificate /etc/letsencrypt/live/{{ $lineage }}/chain.pem;
add_header Strict-Transport-Security "max-age=31536000" always;
