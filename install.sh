#!/usr/bin/env bash
# Beacon panel installer — idempotent, Ubuntu 22.04/24.04.
# Usage:
#   curl -fsSL …/install.sh | sudo bash -s -- [--domain FQDN] [--email EMAIL] [--no-mysql]
#   sudo bash install.sh [--domain FQDN] [--email EMAIL] [--ref v1.0.0] [--admin-email …]
set -euo pipefail

BEACON_ROOT="/opt/beacon"
BEACON_BIN="${BEACON_ROOT}/bin"
PANEL_ROOT="${BEACON_ROOT}/panel"
PANEL_SHARED="${PANEL_ROOT}/shared"
PANEL_CURRENT="${PANEL_ROOT}/current"
PANEL_USER="beacon-panel"
PANEL_PHP="${BEACON_PANEL_PHP_VERSION:-8.4}"
PANEL_REPO="${BEACON_PANEL_REPO:-https://github.com/beacon-org/beacon.git}"
LOG="/var/log/beacon-install.log"
BEACON_PHP_VERSIONS=(8.1 8.2 8.3 8.4)
BEACON_NODE_MAJORS=(20 22 24)
BEACON_NODE_RELEASES=(20.18.2 22.14.0 24.0.2)
BEACON_DEFAULT_NODE_MAJOR=22

DOMAIN=""
EMAIL=""
REF=""
ADMIN_NAME=""
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
SKIP_MYSQL=0
SKIP_PANEL=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain) DOMAIN="$2"; shift 2 ;;
        --email) EMAIL="$2"; shift 2 ;;
        --ref) REF="$2"; shift 2 ;;
        --repo) PANEL_REPO="$2"; shift 2 ;;
        --admin-name) ADMIN_NAME="$2"; shift 2 ;;
        --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
        --admin-password) ADMIN_PASSWORD="$2"; shift 2 ;;
        --no-mysql) SKIP_MYSQL=1; shift ;;
        --skip-panel) SKIP_PANEL=1; shift ;;
        *) echo "Unknown option: $1" >&2; exit 64 ;;
    esac
done

exec > >(tee -a "$LOG") 2>&1

echo "==> Beacon install started $(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ "$(id -u)" -ne 0 ]]; then
    echo "Run as root (sudo)." >&2
    exit 64
fi

if ! grep -qiE 'ubuntu|debian' /etc/os-release 2>/dev/null; then
    echo "WARN: Beacon is tested on Ubuntu 24.04/22.04 only." >&2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
if [[ -z "$SCRIPT_DIR" || "$SCRIPT_DIR" == "/" || ! -f "${SCRIPT_DIR}/artisan" ]]; then
    SCRIPT_DIR=""
fi

# ── Users ─────────────────────────────────────────────────────────────
if ! id beacon &>/dev/null; then
    useradd --create-home --home-dir /home/beacon --shell /bin/bash --user-group beacon
fi
usermod --append --groups www-data beacon 2>/dev/null || true
chown beacon:www-data /home/beacon
chmod 750 /home/beacon

if ! id "$PANEL_USER" &>/dev/null; then
    useradd --system --create-home --home-dir "/home/${PANEL_USER}" \
        --shell /usr/sbin/nologin --user-group "$PANEL_USER"
fi

configure_beacon_shell() {
    local bashrc=/home/beacon/.bashrc
    touch "$bashrc"
    chown beacon:beacon "$bashrc"
    if ! grep -q 'Beacon site umask' "$bashrc" 2>/dev/null; then
        cat >> "$bashrc" <<'EOF'

# Beacon site umask — group-writable files (0664) and directories (2775)
umask 0002
EOF
    fi
}

configure_beacon_shell

install -d -o beacon -g beacon -m 0700 /home/beacon/.ssh
install -d -o beacon -g beacon -m 0750 /home/beacon/.beacon/{bin,deploy}
install -d -o "$PANEL_USER" -g "$PANEL_USER" -m 0750 \
    /var/log/beacon/{deployments,commands,panel-updates,backups}
install -d -o beacon -g "$PANEL_USER" -m 0750 /var/log/beacon/sites
install -d -o www-data -g www-data -m 0755 /var/www/beacon-acme
touch /var/log/beacon/panel-php-error.log /var/log/beacon/panel-worker.log
chown "$PANEL_USER:$PANEL_USER" /var/log/beacon/panel-{php-error,worker}.log
chmod 0640 /var/log/beacon/panel-{php-error,worker}.log

# ── Swap + OOM (audit §0.3) ─────────────────────────────────────────
ram_mb=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)
if [[ -z "$(swapon --show --noheadings 2>/dev/null || true)" && "$ram_mb" -lt 4096 && "$ram_mb" -gt 0 ]]; then
    swap_mb=$(( ram_mb * 2 )); (( swap_mb < 2048 )) && swap_mb=2048
    (( swap_mb > 4096 )) && swap_mb=4096
    avail_mb=$(df --output=avail -m / | tail -1)
    if (( avail_mb > swap_mb + 5120 )); then
        fstype=$(findmnt -no FSTYPE / 2>/dev/null || echo ext4)
        if [[ "$fstype" == "btrfs" ]]; then
            truncate -s 0 /swapfile 2>/dev/null || true
            chattr +C /swapfile 2>/dev/null || true
        fi
        fallocate -l "${swap_mb}M" /swapfile 2>/dev/null \
            || dd if=/dev/zero of=/swapfile bs=1M count="$swap_mb" status=none
        chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
        grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw,nofail 0 0' >> /etc/fstab
        printf 'vm.swappiness=10\nvm.vfs_cache_pressure=50\n' > /etc/sysctl.d/99-beacon.conf
        sysctl -q --system 2>/dev/null || true
    fi
fi

for unit in mysql redis-server nginx supervisor; do
    install -d "/etc/systemd/system/${unit}.service.d"
    printf '[Service]\nOOMScoreAdjust=-500\n' > "/etc/systemd/system/${unit}.service.d/99-beacon-oom.conf"
done
for ver in "${BEACON_PHP_VERSIONS[@]}"; do
    unit="php${ver}-fpm"
    install -d "/etc/systemd/system/${unit}.service.d"
    printf '[Service]\nOOMScoreAdjust=-500\n' > "/etc/systemd/system/${unit}.service.d/99-beacon-oom.conf"
done
systemctl daemon-reload 2>/dev/null || true

# ── Wrappers + sudoers ──────────────────────────────────────────────
install -d -m 0755 "$BEACON_BIN"
WRAPPER_SRC="${SCRIPT_DIR}/bin/wrappers"
if [[ -z "$SCRIPT_DIR" || ! -d "$WRAPPER_SRC" ]]; then
    WRAPPER_SRC="$(pwd)/bin/wrappers"
fi
for wrapper in nginx php supervisor certbot service pkg cron update run fs; do
    src="${WRAPPER_SRC}/beacon-${wrapper}"
    if [[ -f "$src" ]]; then
        install -m 0755 "$src" "${BEACON_BIN}/beacon-${wrapper}"
    fi
done

SUDOERS_SRC="${SCRIPT_DIR}/bin/sudoers/beacon-panel"
if [[ -z "$SCRIPT_DIR" || ! -f "$SUDOERS_SRC" ]]; then
    SUDOERS_SRC="$(pwd)/bin/sudoers/beacon-panel"
fi
if [[ -f "$SUDOERS_SRC" ]]; then
    visudo -cf "$SUDOERS_SRC"
    install -m 0440 "$SUDOERS_SRC" /etc/sudoers.d/beacon-panel
fi

panel_primary_ip() {
    hostname -I 2>/dev/null | awk '{print $1; exit}'
}

apt_wait() {
    local waited=0
    local max=300

    while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 \
       || fuser /var/lib/dpkg/lock >/dev/null 2>&1 \
       || fuser /var/lib/apt/lists/lock >/dev/null 2>&1; do
        if (( waited >= max )); then
            echo "WARN: apt locks still held after ${max}s — proceeding anyway" >&2
            return 0
        fi
        echo "    Waiting for unattended-upgrades to release apt locks…"
        sleep 5
        waited=$((waited + 5))
    done
}

apt_update() {
    apt_wait
    apt-get update -qq
}

apt_install() {
    apt_wait
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@" 2>/dev/null || true
}

seed_git_known_hosts() {
    echo "==> Pre-seeding Git SSH host keys for site deploys"

    local known=/home/beacon/.ssh/known_hosts
    touch "$known"
    chown beacon:beacon "$known"
    chmod 600 "$known"

    if ! ssh-keygen -F github.com -f "$known" >/dev/null 2>&1; then
        ssh-keyscan -H github.com gitlab.com bitbucket.org >> "$known" 2>/dev/null || true
        chown beacon:beacon "$known"
        chmod 600 "$known"
    fi
}

configure_nginx_catch_all() {
    echo "==> Installing Nginx 000-catch-all default vhost"

    local deploy_dir="${SCRIPT_DIR}/deploy"
    if [[ ! -d "$deploy_dir" ]]; then
        deploy_dir="$(pwd)/deploy"
    fi

    install -m 0644 "${deploy_dir}/nginx/000-catch-all.conf" /etc/nginx/sites-available/000-catch-all
    ln -sfn /etc/nginx/sites-available/000-catch-all /etc/nginx/sites-enabled/000-catch-all
    rm -f /etc/nginx/sites-enabled/default
}

bootstrap_panel() {
    echo "==> Bootstrapping panel under ${PANEL_ROOT}"

    install -d -m 0755 "${PANEL_ROOT}/releases"
    install -d -o "$PANEL_USER" -g "$PANEL_USER" -m 2770 "$PANEL_SHARED"
    install -d -o "$PANEL_USER" -g "$PANEL_USER" -m 2770 \
        "${PANEL_SHARED}/storage"/{app/public,framework/{cache,sessions,views},logs}
    install -d -o "$PANEL_USER" -g "$PANEL_USER" -m 2770 "${PANEL_SHARED}/bootstrap-cache"

    ensure_panel_env

    if [[ -L "$PANEL_CURRENT" && -f "${PANEL_CURRENT}/artisan" ]]; then
        echo "    Panel release already present at ${PANEL_CURRENT} — skipping build"
        return 0
    fi

    rel="${PANEL_ROOT}/releases/$(date -u +%Y%m%d%H%M%S)"
    install -d -o "$PANEL_USER" -g "$PANEL_USER" -m 0755 "$rel"

    if [[ -n "$SCRIPT_DIR" && -f "${SCRIPT_DIR}/artisan" ]]; then
        echo "    Copying panel source from ${SCRIPT_DIR}"
        rsync -a \
            --exclude '.git' \
            --exclude 'node_modules' \
            --exclude 'vendor' \
            --exclude 'storage' \
            --exclude 'bootstrap/cache' \
            --exclude '.env' \
            "${SCRIPT_DIR}/" "${rel}/"
    else
        tag="${REF:-main}"
        echo "    Cloning ${PANEL_REPO} @ ${tag}"
        runuser -u "$PANEL_USER" -- git clone --depth 1 --branch "$tag" "$PANEL_REPO" "$rel"
    fi

    runuser -u "$PANEL_USER" -- composer install -d "$rel" --no-dev --no-interaction \
        --prefer-dist --optimize-autoloader
    runuser -u "$PANEL_USER" -- npm --prefix "$rel" ci
    runuser -u "$PANEL_USER" -- npm --prefix "$rel" run build

    rm -rf "$rel/storage" "$rel/bootstrap/cache"
    ln -sfn "${PANEL_SHARED}/.env" "${rel}/.env"
    ln -sfn "${PANEL_SHARED}/storage" "${rel}/storage"
    ln -sfn "${PANEL_SHARED}/bootstrap-cache" "${rel}/bootstrap/cache"

    runuser -u "$PANEL_USER" -- php "$rel/artisan" migrate --force --no-interaction
    runuser -u "$PANEL_USER" -- php "$rel/artisan" optimize

    chown -R root:"$PANEL_USER" "$rel"
    chmod -R go-w "$rel"

    ln -sfn "$rel" "${PANEL_ROOT}/current.new"
    mv -Tf "${PANEL_ROOT}/current.new" "$PANEL_CURRENT"
}

ensure_panel_env() {
    local env_file="${PANEL_SHARED}/.env"
    if [[ -f "$env_file" ]]; then
        return 0
    fi

    local template="${SCRIPT_DIR}/deploy/env/panel.env"
    if [[ ! -f "$template" ]]; then
        template="$(pwd)/deploy/env/panel.env"
    fi
    [[ -f "$template" ]] || { echo "Missing deploy/env/panel.env template" >&2; exit 1; }

    local app_url="https://$(panel_primary_ip):8443"
    if [[ -n "$DOMAIN" ]]; then
        app_url="https://${DOMAIN}"
    fi

    local app_key
    app_key="base64:$(openssl rand -base64 32)"

    local mysql_password=""
    if [[ -f /root/.beacon-mysql-admin ]]; then
        mysql_password="$(tr -d '\n' < /root/.beacon-mysql-admin)"
    fi

    sed \
        -e "s|__APP_KEY__|${app_key}|" \
        -e "s|__APP_URL__|${app_url}|" \
        -e "s|__PANEL_SHARED__|${PANEL_SHARED}|g" \
        -e "s|__PANEL_REPO__|${PANEL_REPO}|g" \
        -e "s|__MYSQL_PASSWORD__|${mysql_password}|g" \
        "$template" > "$env_file"

    chown root:"$PANEL_USER" "$env_file"
    chmod 0640 "$env_file"
    touch "${PANEL_SHARED}/beacon.sqlite"
    chown "$PANEL_USER:$PANEL_USER" "${PANEL_SHARED}/beacon.sqlite"
    chmod 0640 "${PANEL_SHARED}/beacon.sqlite"
}

configure_panel_runtime() {
    echo "==> Configuring panel nginx, PHP-FPM, Supervisor, and scheduler"

    local deploy_dir="${SCRIPT_DIR}/deploy"
    if [[ ! -d "$deploy_dir" ]]; then
        deploy_dir="$(pwd)/deploy"
    fi

    install -m 0644 "${deploy_dir}/nginx/beacon-global.conf" /etc/nginx/conf.d/beacon-global.conf

    configure_nginx_catch_all

    export PANEL_PHP PANEL_CURRENT PANEL_DOMAIN="${DOMAIN:-_}"
    envsubst '${PANEL_PHP} ${PANEL_CURRENT} ${PANEL_DOMAIN}' \
        < "${deploy_dir}/nginx/beacon-panel.conf" \
        > /etc/nginx/sites-available/beacon-panel
    ln -sfn /etc/nginx/sites-available/beacon-panel /etc/nginx/sites-enabled/beacon-panel

    envsubst '${PANEL_PHP} ${PANEL_CURRENT}' \
        < "${deploy_dir}/php/beacon-panel.pool.conf" \
        > "/etc/php/${PANEL_PHP}/fpm/pool.d/beacon-panel.conf"

    envsubst '${PANEL_PHP} ${PANEL_CURRENT}' \
        < "${deploy_dir}/supervisor/beacon-panel-worker.conf" \
        > /etc/supervisor/conf.d/beacon-panel-worker.conf

    nginx -t
    systemctl enable "php${PANEL_PHP}-fpm" nginx redis-server supervisor 2>/dev/null || true
    systemctl restart "php${PANEL_PHP}-fpm" nginx redis-server supervisor

    supervisorctl reread
    supervisorctl update
    supervisorctl restart beacon-panel-worker || supervisorctl start beacon-panel-worker

    local cron_line="* * * * * cd ${PANEL_CURRENT} && /usr/bin/php${PANEL_PHP} artisan schedule:run >> /dev/null 2>&1"
    (crontab -u "$PANEL_USER" -l 2>/dev/null | grep -v 'artisan schedule:run' || true; echo "$cron_line") \
        | crontab -u "$PANEL_USER" -
}

maybe_issue_panel_certificate() {
    [[ -n "$DOMAIN" && -n "$EMAIL" ]] || return 0
    [[ -f "${PANEL_CURRENT}/artisan" ]] || return 0

    echo "==> Requesting Let's Encrypt certificate for ${DOMAIN}"
    certbot certonly --webroot -w /var/www/beacon-acme \
        -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive --keep-until-expiring \
        || { echo "WARN: certbot failed — panel remains on HTTP" >&2; return 0; }

    local deploy_dir="${SCRIPT_DIR}/deploy"
    [[ -d "$deploy_dir" ]] || deploy_dir="$(pwd)/deploy"

    cat > /etc/nginx/sites-available/beacon-panel <<EOF
# Managed by Beacon install.sh — panel vhost with TLS.
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/beacon-acme;
        default_type "text/plain";
        allow all;
    }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};
    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/${DOMAIN}/chain.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    add_header Strict-Transport-Security "max-age=31536000" always;

    root ${PANEL_CURRENT}/public;
    index index.php index.html;
    charset utf-8;

    location / { try_files \$uri \$uri/ /index.php?\$query_string; }
    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }
    error_page 404 /index.php;

    location ~ \\.php\$ {
        fastcgi_pass unix:/run/php/php${PANEL_PHP}-fpm-beacon-panel.sock;
        fastcgi_split_path_info ^(.+\\.php)(/.+)\$;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT \$realpath_root;
        fastcgi_hide_header X-Powered-By;
        fastcgi_read_timeout 120;
    }

    location ~ /\\.(?!well-known).* { deny all; }

    access_log /var/log/nginx/beacon-panel-access.log;
    error_log  /var/log/nginx/beacon-panel-error.log error;
}
EOF

    nginx -t && systemctl reload nginx
}

configure_panel_self_signed_tls() {
    [[ -z "$DOMAIN" ]] || return 0
    [[ -f "${PANEL_CURRENT}/artisan" ]] || return 0

    echo "==> Configuring panel self-signed TLS on :8443"

    local deploy_dir="${SCRIPT_DIR}/deploy"
    [[ -d "$deploy_dir" ]] || deploy_dir="$(pwd)/deploy"

    local ssl_dir="/etc/beacon/ssl"
    local cert="${ssl_dir}/panel.crt"
    local key="${ssl_dir}/panel.key"
    install -d -m 0755 "$ssl_dir"
    if [[ ! -f "$cert" || ! -f "$key" ]]; then
        openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
            -keyout "$key" -out "$cert" \
            -subj "/CN=Beacon Panel/O=Beacon/C=US" >/dev/null 2>&1
        chmod 0644 "$cert"
        chmod 0600 "$key"
    fi

    export PANEL_PHP PANEL_CURRENT PANEL_SSL_CERT="$cert" PANEL_SSL_KEY="$key"
    envsubst '${PANEL_PHP} ${PANEL_CURRENT} ${PANEL_SSL_CERT} ${PANEL_SSL_KEY}' \
        < "${deploy_dir}/nginx/beacon-panel-8443.conf" \
        > /etc/nginx/sites-available/beacon-panel
    ln -sfn /etc/nginx/sites-available/beacon-panel /etc/nginx/sites-enabled/beacon-panel

    local ip
    ip="$(panel_primary_ip)"
    if [[ -n "$ip" && -f "${PANEL_SHARED}/.env" ]]; then
        sed -i "s|^APP_URL=.*|APP_URL=https://${ip}:8443|" "${PANEL_SHARED}/.env"
    fi

    nginx -t && systemctl reload nginx
}

configure_ufw() {
    echo "==> Configuring UFW (SSH, HTTP, HTTPS, panel :8443 — MySQL stays closed)"

    apt_install ufw
    if ! command -v ufw >/dev/null 2>&1; then
        echo "WARN: ufw not available — skipping firewall" >&2
        return 0
    fi

    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow OpenSSH
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 8443/tcp
    ufw --force enable
}

ensure_ondrej_php_ppa() {
    if apt-cache show "php${PANEL_PHP}-fpm" >/dev/null 2>&1; then
        return 0
    fi

    echo "==> Adding Ondrej PHP APT source (setup-php.com mirror)"

    # shellcheck disable=SC1091
    . /etc/os-release
    local codename="${VERSION_CODENAME:-noble}"
    local arch mirror keyring list
    arch="$(dpkg --print-architecture 2>/dev/null || echo amd64)"
    mirror="https://ppa.setup-php.com/ondrej/php/ubuntu"
    keyring="/usr/share/keyrings/ondrej-php.gpg"
    list="/etc/apt/sources.list.d/ondrej-php.list"

    install -d /usr/share/keyrings
    curl -fsSL "${mirror}/key.gpg" | gpg --dearmor --yes -o "$keyring"
    chmod 644 "$keyring"

    cat > "$list" <<EOF
deb [arch=${arch} signed-by=${keyring}] ${mirror} ${codename} main
EOF

    rm -f /etc/apt/sources.list.d/ondrej-ubuntu-php-*.list \
          /etc/apt/sources.list.d/ondrej-ubuntu-php-*.sources 2>/dev/null || true

    apt_update
}

install_php_versions() {
    echo "==> Installing PHP ${BEACON_PHP_VERSIONS[*]} (FPM + common site extensions)"

    local packages=()
    local ver pkg
    for ver in "${BEACON_PHP_VERSIONS[@]}"; do
        for pkg in fpm cli mbstring xml curl zip redis mysql; do
            packages+=("php${ver}-${pkg}")
        done
    done

    packages+=(
        "php${PANEL_PHP}-sqlite3"
        "php${PANEL_PHP}-mbstring"
        "php${PANEL_PHP}-xml"
        "php${PANEL_PHP}-curl"
        "php${PANEL_PHP}-zip"
        "php${PANEL_PHP}-redis"
    )

    apt_install "${packages[@]}"

    for ver in "${BEACON_PHP_VERSIONS[@]}"; do
        systemctl enable "php${ver}-fpm" 2>/dev/null || true
        systemctl start "php${ver}-fpm" 2>/dev/null || true
    done
}

node_platform_arch() {
    local arch
    arch="$(dpkg --print-architecture 2>/dev/null || uname -m)"
    case "$arch" in
        amd64|x86_64) echo 'linux-x64' ;;
        arm64|aarch64) echo 'linux-arm64' ;;
        *) echo "unsupported-${arch}" ;;
    esac
}

install_node_release() {
    local major="$1"
    local release="$2"
    local platform dest tarball url tmp extracted

    dest="/usr/local/node/v${major}"
    if [[ -x "${dest}/bin/node" ]]; then
        echo "    Node ${major} already present at ${dest}"
        return 0
    fi

    platform="$(node_platform_arch)"
    if [[ "$platform" == unsupported-* ]]; then
        echo "WARN: unsupported CPU architecture for Node.js — skipping v${major}" >&2
        return 0
    fi

    tarball="node-v${release}-${platform}.tar.xz"
    url="https://nodejs.org/dist/v${release}/${tarball}"
    tmp="$(mktemp -d)"
    extracted="${tmp}/node-v${release}-${platform}"

    echo "    Installing Node.js ${release} → ${dest}"
    if ! curl -fsSL "$url" -o "${tmp}/${tarball}"; then
        echo "WARN: could not download Node.js v${release} — skipping" >&2
        rm -rf "$tmp"
        return 0
    fi

    tar -xJf "${tmp}/${tarball}" -C "$tmp"
    install -d /usr/local/node
    rm -rf "$dest"
    mv "$extracted" "$dest"
    rm -rf "$tmp"
}

install_node_runtimes() {
    echo "==> Installing Node.js runtimes under /usr/local/node"

    local i major release
    for i in "${!BEACON_NODE_MAJORS[@]}"; do
        major="${BEACON_NODE_MAJORS[$i]}"
        release="${BEACON_NODE_RELEASES[$i]}"
        install_node_release "$major" "$release"
    done

    if [[ -d "/usr/local/node/v${BEACON_DEFAULT_NODE_MAJOR}/bin" ]]; then
        ln -sfn "/usr/local/node/v${BEACON_DEFAULT_NODE_MAJOR}" /usr/local/node/default
        ln -sfn /usr/local/node/default/bin/node /usr/local/bin/node
        ln -sfn /usr/local/node/default/bin/npm /usr/local/bin/npm
        ln -sfn /usr/local/node/default/bin/npx /usr/local/bin/npx
    fi
}

install_bun_runtime() {
    echo "==> Installing Bun under /usr/local/bun/default"

    if [[ -x /usr/local/bun/default/bin/bun ]]; then
        echo "    Bun already present"
        return 0
    fi

    install -d /usr/local/bun
    if ! BUN_INSTALL=/usr/local/bun/default bash -c "$(curl -fsSL https://bun.sh/install)"; then
        echo "WARN: Bun installation failed — sites can still use npm" >&2
        return 0
    fi

    chmod -R a+rx /usr/local/bun/default
}

configure_mysql() {
    echo "==> Hardening MySQL and provisioning beacon_admin"

    local deploy_dir="${SCRIPT_DIR}/deploy"
    if [[ ! -d "$deploy_dir" ]]; then
        deploy_dir="$(pwd)/deploy"
    fi

    if [[ -f "${deploy_dir}/mysql/99-beacon.cnf" ]]; then
        install -m 0644 "${deploy_dir}/mysql/99-beacon.cnf" /etc/mysql/mysql.conf.d/99-beacon.cnf
        systemctl restart mysql 2>/dev/null || true
    fi

    if ! command -v mysql >/dev/null 2>&1; then
        echo "WARN: mysql client missing — skipping beacon_admin provisioning" >&2
        return 0
    fi

    local secret_file="/root/.beacon-mysql-admin"
    local password
    if [[ -f "$secret_file" ]]; then
        password="$(tr -d '\n' < "$secret_file")"
    else
        password="$(openssl rand -hex 16)"
        printf '%s' "$password" > "$secret_file"
        chmod 0600 "$secret_file"
    fi

    mysql --protocol=socket <<SQL
CREATE USER IF NOT EXISTS 'beacon_admin'@'localhost' IDENTIFIED BY '${password}';
ALTER USER 'beacon_admin'@'localhost' IDENTIFIED BY '${password}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER, REFERENCES,
      CREATE TEMPORARY TABLES, LOCK TABLES, EXECUTE, CREATE VIEW, SHOW VIEW,
      CREATE ROUTINE, ALTER ROUTINE, EVENT, TRIGGER, SHOW DATABASES
  ON *.* TO 'beacon_admin'@'localhost' WITH GRANT OPTION;
GRANT CREATE USER, BACKUP_ADMIN ON *.* TO 'beacon_admin'@'localhost';
SQL

    if [[ -f "${PANEL_SHARED}/.env" ]]; then
        if grep -q '^BEACON_MYSQL_PASSWORD=' "${PANEL_SHARED}/.env"; then
            sed -i "s|^BEACON_MYSQL_PASSWORD=.*|BEACON_MYSQL_PASSWORD=${password}|" "${PANEL_SHARED}/.env"
        else
            printf '\nBEACON_MYSQL_PASSWORD=%s\n' "$password" >> "${PANEL_SHARED}/.env"
        fi
    fi
}

maybe_create_admin() {
    [[ -n "$ADMIN_EMAIL" && -n "$ADMIN_PASSWORD" ]] || return 0
    [[ -f "${PANEL_CURRENT}/artisan" ]] || return 0

    local name="${ADMIN_NAME:-Beacon Admin}"
    echo "==> Creating administrator ${ADMIN_EMAIL}"

    runuser -u "$PANEL_USER" -- php "${PANEL_CURRENT}/artisan" beacon:create-admin \
        --name="$name" \
        --email="$ADMIN_EMAIL" \
        --password="$ADMIN_PASSWORD" \
        --no-interaction \
        || echo "WARN: admin creation failed — run beacon:create-admin manually" >&2
}

# ── Base packages (best-effort) ─────────────────────────────────────
export DEBIAN_FRONTEND=noninteractive
apt_update
apt_install nginx redis-server supervisor certbot gettext-base ufw \
    openssh-client git curl unzip acl python3 rsync gpg

if [[ "$SKIP_MYSQL" -eq 0 ]]; then
    apt_install mysql-server
fi

ensure_ondrej_php_ppa
install_php_versions
install_node_runtimes
install_bun_runtime
seed_git_known_hosts

if ! command -v composer >/dev/null 2>&1; then
    curl -fsSL https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi

if [[ "$SKIP_MYSQL" -eq 0 ]]; then
    configure_mysql
fi

# ── Panel layout + release ──────────────────────────────────────────
if [[ "$SKIP_PANEL" -eq 0 ]]; then
    bootstrap_panel
    configure_panel_runtime
    configure_ufw
    if [[ -n "$DOMAIN" ]]; then
        maybe_issue_panel_certificate
    else
        configure_panel_self_signed_tls
    fi
    maybe_create_admin
fi

if [[ -f "${SCRIPT_DIR}/deploy/logrotate/beacon" ]]; then
    install -m 0644 "${SCRIPT_DIR}/deploy/logrotate/beacon" /etc/logrotate.d/beacon
elif [[ -f "$(pwd)/deploy/logrotate/beacon" ]]; then
    install -m 0644 "$(pwd)/deploy/logrotate/beacon" /etc/logrotate.d/beacon
fi

echo "==> Beacon install complete."
if [[ -f "${PANEL_CURRENT}/artisan" ]]; then
    if [[ -n "$DOMAIN" ]]; then
        scheme="http"
        [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]] && scheme="https"
        echo "    Panel URL: ${scheme}://${DOMAIN}/"
    else
        ip="$(panel_primary_ip)"
        echo "    Panel URL: https://${ip}:8443/ (self-signed — attach a domain in Settings for Let's Encrypt)"
    fi
    echo "    Create an admin: sudo -u ${PANEL_USER} php ${PANEL_CURRENT}/artisan beacon:create-admin"
else
    echo "    Panel bootstrap skipped or incomplete — check ${LOG}"
fi
