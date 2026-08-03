{{-- resources/views/nginx/partials/acme.blade.php --}}
# Shared ACME webroot — works before the app is deployed, and for every site type.
location ^~ /.well-known/acme-challenge/ {
    root /var/www/beacon-acme;
    default_type "text/plain";
    allow all;
}
