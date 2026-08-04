#!/usr/bin/env bash
# Shared systemd ProtectSystem ReadWritePaths for Beacon's privileged wrappers.
# Sourced by install.sh and beacon-update.

beacon_rw_paths() {
    local paths multarch=""

    if command -v dpkg-architecture >/dev/null 2>&1; then
        multarch="$(dpkg-architecture -qDEB_HOST_MULTIARCH 2>/dev/null || true)"
    fi

    paths="-/etc/nginx -/etc/letsencrypt -/etc/php -/etc/supervisor"
    paths+=" -/var/www -/var/log/beacon -/opt/beacon -/home/beacon"
    paths+=" -/usr/lib/php"

    if [[ -n "$multarch" ]]; then
        paths+=" -/usr/lib/${multarch}"
    fi

    printf '%s' "$paths"
}

beacon_write_sandbox_dropin() {
    local unit="$1"
    local rw_paths

    rw_paths="$(beacon_rw_paths)"

    install -d "/etc/systemd/system/${unit}.service.d"
    cat > "/etc/systemd/system/${unit}.service.d/99-beacon-paths.conf" <<EOF
[Service]
# Beacon writes these through its restricted sudo wrappers; see bin/lib/beacon-sandbox-paths.sh.
ReadWritePaths=${rw_paths}
EOF
}

beacon_sync_sandbox_dropins() {
    local panel_php="${1:-${BEACON_PANEL_PHP_VERSION:-8.4}}"

    beacon_write_sandbox_dropin "php${panel_php}-fpm"
    beacon_write_sandbox_dropin supervisor

    if command -v systemctl >/dev/null 2>&1; then
        systemctl daemon-reload 2>/dev/null || true
    fi
}
