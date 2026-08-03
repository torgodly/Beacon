#!/usr/bin/env bash
# Beacon panel installer — interactive, idempotent, Ubuntu 22.04/24.04.
#
# Just run it and answer the questions:
#   curl -fsSL https://beacon.sh/install.sh | sudo bash
#   sudo bash install.sh
#
# Every answer can also be supplied up front, which skips the matching
# question. Supplying --yes (or piping with no TTY) runs fully unattended:
#   sudo bash install.sh --domain panel.example.com --email me@example.com \
#        --admin-email me@example.com --admin-password '…' --yes
set -euo pipefail

BEACON_ROOT="/opt/beacon"
BEACON_BIN="${BEACON_ROOT}/bin"
PANEL_ROOT="${BEACON_ROOT}/panel"
PANEL_SHARED="${PANEL_ROOT}/shared"
PANEL_CURRENT="${PANEL_ROOT}/current"
PANEL_USER="beacon-panel"
PANEL_PHP="${BEACON_PANEL_PHP_VERSION:-8.4}"
PANEL_REPO="${BEACON_PANEL_REPO:-https://github.com/torgodly/beacon.git}"
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
ASSUME_YES=0
PHP_SELECTION=""
NODE_SELECTION=""
DOMAIN_ANSWERED=0
MYSQL_ANSWERED=0

usage() {
    cat <<'USAGE'
Beacon installer

  sudo bash install.sh                 Guided install — asks a few questions.
  curl -fsSL … | sudo bash             Same, works over a pipe.

Options (each one skips its question):
  --domain FQDN          Hostname to serve the panel on (Let's Encrypt).
  --email EMAIL          Contact address for the TLS certificate.
  --admin-name NAME      Administrator display name.
  --admin-email EMAIL    Administrator login.
  --admin-password PASS  Administrator password (min 12 characters).
  --php "8.3 8.4"        PHP versions to install. Default: all supported.
  --node 22              Default Node major version.
  --no-mysql             Do not install or configure MySQL.
  --skip-panel           Provision the host only; do not deploy the panel.
  --ref TAG              Panel release to deploy.
  --repo URL             Panel git repository.
  -y, --yes              Never prompt; accept defaults for anything unset.
  -h, --help             Show this message.
USAGE
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain) DOMAIN="$2"; DOMAIN_ANSWERED=1; shift 2 ;;
        --email) EMAIL="$2"; shift 2 ;;
        --ref) REF="$2"; shift 2 ;;
        --repo) PANEL_REPO="$2"; shift 2 ;;
        --admin-name) ADMIN_NAME="$2"; shift 2 ;;
        --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
        --admin-password) ADMIN_PASSWORD="$2"; shift 2 ;;
        --php) PHP_SELECTION="$2"; shift 2 ;;
        --node) NODE_SELECTION="$2"; shift 2 ;;
        --no-mysql) SKIP_MYSQL=1; MYSQL_ANSWERED=1; shift ;;
        --skip-panel) SKIP_PANEL=1; shift ;;
        -y|--yes) ASSUME_YES=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown option: $1" >&2; usage >&2; exit 64 ;;
    esac
done

# ── Preflight, before we ask anything ────────────────────────────────
# Asking six questions and only then discovering we are not root would be
# a poor trade of the operator's attention.
if [[ "$(id -u)" -ne 0 ]]; then
    echo "Beacon must be installed as root. Re-run with sudo:" >&2
    echo "  curl -fsSL …/install.sh | sudo bash" >&2
    exit 64
fi

# Note the `;` rather than `&&`: with `&&` a missing /etc/os-release makes the
# substitution exit non-zero, and under `set -e` the assignment takes the whole
# installer down before it has said anything.
OS_PRETTY="unknown"
if [[ -r /etc/os-release ]]; then
    OS_PRETTY="$( . /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-unknown}" )"
fi

# ── Terminal plumbing ────────────────────────────────────────────────
# `curl … | sudo bash` hands the script itself to stdin, so a bare `read`
# would silently swallow the script's own remaining lines. Everything
# interactive therefore goes through /dev/tty on its own descriptor.
# The braces matter: `exec 3</dev/tty 2>/dev/null` still lets bash print its
# own "Device not configured" to the real stderr, because the redirect is
# applied to exec rather than to the shell reporting the failure.
HAS_TTY=0
if { exec 3</dev/tty; } 2>/dev/null; then
    HAS_TTY=1
fi

INTERACTIVE=1
if [[ "$HAS_TTY" -eq 0 || "$ASSUME_YES" -eq 1 ]]; then
    INTERACTIVE=0
fi

if [[ -t 2 && -z "${NO_COLOR:-}" ]]; then
    C_DIM=$'\033[90m'; C_CYAN=$'\033[36m'; C_BOLD=$'\033[1m'
    C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_OFF=$'\033[0m'
else
    C_DIM=""; C_CYAN=""; C_BOLD=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_OFF=""
fi

# Prompts go straight to the terminal, never through the tee'd log — the
# log should record decisions, not redraw the questionnaire.
say()  { printf '%s\n' "$*" >&2; }
tty_out() { if [[ "$HAS_TTY" -eq 1 ]]; then printf '%b' "$*" >/dev/tty; else printf '%b' "$*" >&2; fi; }

banner() {
    tty_out "\n${C_CYAN}${C_BOLD}"
    tty_out "  ██████  BEACON\n"
    tty_out "${C_OFF}${C_DIM}  Self-hosted server control panel · installer${C_OFF}\n\n"
    tty_out "  ${C_DIM}host${C_OFF}  $(hostname)\n"
    tty_out "  ${C_DIM}os${C_OFF}    ${OS_PRETTY}\n"
    tty_out "  ${C_DIM}log${C_OFF}   ${LOG}\n\n"
}

section() { tty_out "\n${C_BOLD}$1${C_OFF}\n${C_DIM}$2${C_OFF}\n\n"; }
hint()    { tty_out "  ${C_DIM}$1${C_OFF}\n"; }
oops()    { tty_out "  ${C_RED}✖ $1${C_OFF}\n"; }

# Best-effort primary IPv4. `hostname -I` is Linux-only and can be empty on a
# host with only a loopback, so fall back through `ip route` before giving up.
primary_ip() {
    local addr
    addr="$(hostname -I 2>/dev/null | awk '{print $1; exit}')"
    [[ -z "$addr" ]] && addr="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')"
    printf '%s' "${addr:-this-server}"
}

# ask <varname> <question> [default] [validator] [validator-hint]
ask() {
    local __var="$1" question="$2" default="${3:-}" validator="${4:-}" vhint="${5:-}"
    local current="${!__var}" answer

    # Already supplied on the command line — do not ask again.
    [[ -n "$current" ]] && return 0

    if [[ "$INTERACTIVE" -eq 0 ]]; then
        printf -v "$__var" '%s' "$default"
        return 0
    fi

    while true; do
        if [[ -n "$default" ]]; then
            tty_out "  ${question} ${C_DIM}[${default}]${C_OFF} "
        else
            tty_out "  ${question} "
        fi

        IFS= read -r answer <&3 || answer=""
        answer="${answer:-$default}"

        if [[ -z "$answer" && -z "$default" ]]; then
            oops "This one is required."
            continue
        fi

        if [[ -n "$validator" ]] && ! "$validator" "$answer"; then
            oops "${vhint:-That does not look right.}"
            continue
        fi

        printf -v "$__var" '%s' "$answer"
        return 0
    done
}

# A 24-character password from openssl, which is already a hard dependency.
#
# `tr -dc … </dev/urandom` is the usual one-liner and it is quietly broken:
# under a UTF-8 locale tr aborts with "Illegal byte sequence" on the first
# invalid sequence, so the pipeline yields a password one or two characters
# long. openssl has no such failure mode.
random_password() {
    # The generated password has to satisfy the same rules beacon:create-admin
    # enforces in production — Password::min(12)->mixedCase()->numbers()
    # ->symbols() — or the very last step of the install fails with
    # "The password field must contain at least one symbol" and no
    # administrator is created.
    #
    # base64 only emits [A-Za-z0-9+/=], so symbols are injected explicitly
    # rather than filtered for. Entropy comes from openssl; $RANDOM only
    # chooses which symbol, on top of 20 already-random alphanumerics.
    local set='!@#%^*_+=-' core s1 s2 attempt=0

    while (( attempt++ < 50 )); do
        core="$(LC_ALL=C openssl rand -base64 48 | LC_ALL=C tr -dc 'A-Za-z0-9' | cut -c1-20)"

        (( ${#core} == 20 )) || continue
        [[ "$core" == *[a-z]* ]] || continue
        [[ "$core" == *[A-Z]* ]] || continue
        [[ "$core" == *[0-9]* ]] || continue

        s1="${set:$(( RANDOM % ${#set} )):1}"
        s2="${set:$(( RANDOM % ${#set} )):1}"

        printf '%s%s%s%s' "${core:0:7}" "$s1" "${core:7}" "$s2"
        return 0
    done

    echo "ERROR: could not generate a compliant password" >&2
    return 1
}

# ask_secret <varname> <question> — hidden input, typed twice.
ask_secret() {
    local __var="$1" question="$2" first second

    [[ -n "${!__var}" ]] && return 0

    if [[ "$INTERACTIVE" -eq 0 ]]; then
        printf -v "$__var" '%s' "$(random_password)"
        GENERATED_PASSWORD=1
        return 0
    fi

    while true; do
        tty_out "  ${question} ${C_DIM}[blank = generate one]${C_OFF} "
        IFS= read -rs first <&3 || first=""
        tty_out "\n"

        if [[ -z "$first" ]]; then
            printf -v "$__var" '%s' "$(random_password)"
            GENERATED_PASSWORD=1
            hint "Generated a 24-character password — shown at the end."
            return 0
        fi

        # Mirror the rules beacon:create-admin enforces in production. Checking
        # here costs a keystroke; discovering it after a five-minute install
        # costs the whole run.
        if (( ${#first} < 12 )); then
            oops "Use at least 12 characters."
            continue
        fi
        if [[ "$first" != *[a-z]* || "$first" != *[A-Z]* ]]; then
            oops "Use both upper and lower case letters."
            continue
        fi
        if [[ "$first" != *[0-9]* ]]; then
            oops "Include at least one number."
            continue
        fi
        # Strip every alphanumeric; anything left over is a symbol. Avoids
        # needing `shopt -s extglob` for a +([A-Za-z0-9]) pattern.
        if [[ -z "${first//[A-Za-z0-9]/}" ]]; then
            oops "Include at least one symbol, e.g. ! @ # % ^ _ + -"
            continue
        fi

        tty_out "  Confirm password: "
        IFS= read -rs second <&3 || second=""
        tty_out "\n"

        if [[ "$first" != "$second" ]]; then
            oops "Those did not match."
            continue
        fi

        printf -v "$__var" '%s' "$first"
        return 0
    done
}

# confirm <question> <default y|n>
confirm() {
    local question="$1" default="${2:-y}" answer suffix

    if [[ "$INTERACTIVE" -eq 0 ]]; then
        [[ "$default" == "y" ]]
        return
    fi

    [[ "$default" == "y" ]] && suffix="[Y/n]" || suffix="[y/N]"

    while true; do
        tty_out "  ${question} ${C_DIM}${suffix}${C_OFF} "
        IFS= read -r answer <&3 || answer=""
        answer="${answer:-$default}"

        # tr rather than ${answer,,} — the latter is bash 4+, and an installer
        # is the last place to depend on the shell being new enough.
        case "$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')" in
            y|yes) return 0 ;;
            n|no)  return 1 ;;
            *) oops "Please answer y or n." ;;
        esac
    done
}

valid_domain() {
    [[ "$1" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$ ]]
}

valid_email() {
    [[ "$1" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$ ]]
}

valid_php_list() {
    local version
    for version in $1; do
        [[ " ${BEACON_PHP_VERSIONS[*]} " == *" ${version} "* ]] || return 1
    done
    [[ -n "$1" ]]
}

valid_node_major() {
    [[ " ${BEACON_NODE_MAJORS[*]} " == *" $1 "* ]]
}

# ── The questionnaire ────────────────────────────────────────────────
GENERATED_PASSWORD=0

banner

if [[ "$INTERACTIVE" -eq 0 && "$HAS_TTY" -eq 0 && "$ASSUME_YES" -eq 0 ]]; then
    hint "No terminal attached — running with defaults. Use --help to see the options."
    tty_out "\n"
fi

if ! grep -qiE 'ubuntu|debian' /etc/os-release 2>/dev/null; then
    tty_out "  ${C_YELLOW}⚠ Beacon is tested on Ubuntu 24.04 and 22.04 only.${C_OFF}\n"
    if ! confirm "Continue anyway?" n; then
        say "Aborted."
        exit 1
    fi
fi

section "1 · How will you reach the panel?" \
    "A real hostname gets a free Let's Encrypt certificate and lets GitHub deliver webhooks. Without one, Beacon serves on https://IP:8443 with a self-signed certificate and falls back to polling for deploys — you can attach a domain later from Settings."

if [[ "$DOMAIN_ANSWERED" -eq 0 && -z "$DOMAIN" ]]; then
    if confirm "Do you have a domain pointed at this server?" y; then
        ask DOMAIN "Panel hostname:" "" valid_domain \
            "Enter a fully-qualified hostname, e.g. panel.example.com"
    else
        hint "Using https://$(primary_ip):8443 with a self-signed certificate."
    fi
fi

if [[ -n "$DOMAIN" ]]; then
    ask EMAIL "Email for the TLS certificate:" "" valid_email \
        "Let's Encrypt needs a valid address for expiry notices."
fi

section "2 · Administrator account" \
    "Public registration is disabled, so this is the only way in. Turn on two-factor authentication at first login."

ask ADMIN_NAME "Your name:" "Beacon Admin"
ask ADMIN_EMAIL "Login email:" "${EMAIL:-}" valid_email "That does not look like an email address."
ask_secret ADMIN_PASSWORD "Password:"

section "3 · Runtimes and services" \
    "Everything runs natively on the host — no containers."

if [[ -z "$PHP_SELECTION" ]]; then
    if [[ "$INTERACTIVE" -eq 1 ]]; then
        hint "Supported: ${BEACON_PHP_VERSIONS[*]}"
    fi
    ask PHP_SELECTION "PHP versions to install:" "${BEACON_PHP_VERSIONS[*]}" \
        valid_php_list "Pick from: ${BEACON_PHP_VERSIONS[*]}"
fi

ask NODE_SELECTION "Default Node major version:" "$BEACON_DEFAULT_NODE_MAJOR" \
    valid_node_major "Pick from: ${BEACON_NODE_MAJORS[*]}"

if [[ "$MYSQL_ANSWERED" -eq 0 ]]; then
    if confirm "Install and configure MySQL 8?" y; then
        SKIP_MYSQL=0
    else
        SKIP_MYSQL=1
    fi
fi

# Apply the answers to the install plan.
read -r -a BEACON_PHP_VERSIONS <<< "$PHP_SELECTION"
BEACON_DEFAULT_NODE_MAJOR="$NODE_SELECTION"

# ── Summary + point of no return ─────────────────────────────────────
section "Ready to install" "Nothing has been changed on this server yet."

tty_out "  ${C_DIM}panel url${C_OFF}      $( [[ -n "$DOMAIN" ]] && echo "https://${DOMAIN}/" || echo "https://$(primary_ip):8443/" )\n"
tty_out "  ${C_DIM}tls${C_OFF}            $( [[ -n "$DOMAIN" ]] && echo "Let's Encrypt (${EMAIL})" || echo "self-signed" )\n"
tty_out "  ${C_DIM}administrator${C_OFF}  ${ADMIN_EMAIL}\n"
tty_out "  ${C_DIM}php${C_OFF}            ${BEACON_PHP_VERSIONS[*]}\n"
tty_out "  ${C_DIM}node${C_OFF}           ${BEACON_DEFAULT_NODE_MAJOR} ${C_DIM}(plus Bun)${C_OFF}\n"
tty_out "  ${C_DIM}mysql${C_OFF}          $( [[ "$SKIP_MYSQL" -eq 0 ]] && echo "yes" || echo "skipped" )\n"
tty_out "  ${C_DIM}also${C_OFF}           nginx · redis · supervisor · certbot · ufw\n\n"

if [[ "$INTERACTIVE" -eq 1 ]]; then
    if ! confirm "Start the install?" y; then
        say "Aborted — nothing was changed."
        exit 0
    fi
fi

tty_out "\n${C_DIM}This takes 3–8 minutes. Full log: ${LOG}${C_OFF}\n\n"

exec > >(tee -a "$LOG") 2>&1

echo "==> Beacon install started $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "==> Plan: domain='${DOMAIN:-none}' php='${BEACON_PHP_VERSIONS[*]}' node='${BEACON_DEFAULT_NODE_MAJOR}' mysql=$(( 1 - SKIP_MYSQL ))"

# Did the operator upload the repo and run install.sh from inside it?
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
if [[ -z "$SCRIPT_DIR" || "$SCRIPT_DIR" == "/" || ! -f "${SCRIPT_DIR}/artisan" ]]; then
    SCRIPT_DIR=""
fi

# ── Fetch our own source when piped ──────────────────────────────────
# `curl … | sudo bash` gives the shell a script on stdin and nothing else, so
# SCRIPT_DIR is empty and every file the installer needs from the repo — the
# sudo wrappers, the sudoers policy, the panel .env template, the nginx and
# MySQL drop-ins — is missing. Clone the repo once, up front, and carry on as
# if the operator had uploaded it.
BEACON_SRC_TMP=""
cleanup_src_tmp() {
    [[ -n "$BEACON_SRC_TMP" && -d "$BEACON_SRC_TMP" ]] && rm -rf "$BEACON_SRC_TMP"
    return 0
}
trap cleanup_src_tmp EXIT

if [[ -z "$SCRIPT_DIR" ]]; then
    echo "==> No local source tree — fetching ${PANEL_REPO}"

    if ! command -v git >/dev/null 2>&1; then
        DEBIAN_FRONTEND=noninteractive apt-get update -qq || true
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git ca-certificates
    fi

    BEACON_SRC_TMP="$(mktemp -d /tmp/beacon-src.XXXXXX)"

    # No --branch unless one was asked for: the repo's default branch may be
    # master or main, and guessing wrong fails the clone outright.
    if [[ -n "$REF" ]]; then
        git clone --depth 1 --branch "$REF" "$PANEL_REPO" "$BEACON_SRC_TMP"
    else
        git clone --depth 1 "$PANEL_REPO" "$BEACON_SRC_TMP"
    fi

    if [[ ! -f "${BEACON_SRC_TMP}/artisan" ]]; then
        echo "ERROR: ${PANEL_REPO} does not look like a Beacon checkout (no artisan)." >&2
        echo "       Pass --repo URL, or upload the source and run install.sh from inside it." >&2
        exit 1
    fi

    SCRIPT_DIR="$BEACON_SRC_TMP"
    echo "    Source ready at ${SCRIPT_DIR} ($(git -C "$SCRIPT_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown))"
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
    /var/log/beacon/{deployments,commands,operations,panel-updates,backups}
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
    primary_ip
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

# Run a command as the panel user, from a directory it can actually enter.
#
# runuser keeps the caller's working directory. The installer runs from root's
# shell — usually /root, which is mode 0700 — so a child dropped to
# beacon-panel cannot stat its own cwd, and the first getcwd()/chdir() it
# attempts dies with "chdir(): Permission denied (errno 13)". Composer does
# exactly that on startup.
# runuser also *preserves* the caller's environment, so HOME stays /root.
# npm would then write its cache to /root/.npm and Composer to /root/.composer,
# both unreadable to beacon-panel. Pin HOME and the cache locations explicitly.
panel_run() {
    local workdir="$1"
    shift
    ( cd "$workdir" && runuser -u "$PANEL_USER" -- env \
        HOME="/home/${PANEL_USER}" \
        USER="$PANEL_USER" \
        COMPOSER_HOME="/home/${PANEL_USER}/.composer" \
        COMPOSER_ALLOW_SUPERUSER=0 \
        NPM_CONFIG_CACHE="/home/${PANEL_USER}/.npm" \
        NPM_CONFIG_UPDATE_NOTIFIER=false \
        NODE_OPTIONS="--max-old-space-size=$(panel_node_heap_mb)" \
        CI=true \
        PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
        "$@" )
}

# Cap V8 so the panel's own Vite build cannot OOM a small VPS.
panel_node_heap_mb() {
    local ram
    ram=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 2048)
    local heap=$(( ram * 65 / 100 ))
    (( heap < 512 )) && heap=512
    (( heap > 4096 )) && heap=4096
    printf '%s' "$heap"
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

        # `rsync -a` implies -o -g, so as root it stamps the copy with the
        # source's ownership (root:root). Composer and npm then cannot create
        # vendor/, node_modules/ or public/build inside their own release
        # directory. Hand the tree back to the panel user for the build; it is
        # re-frozen to root:beacon-panel once the build finishes.
        chown -R "$PANEL_USER:$PANEL_USER" "$rel"
    else
        # Reached only if the source vanished between the fetch and here.
        # No --branch unless asked: the default branch may be master or main.
        echo "    Cloning ${PANEL_REPO}${REF:+ @ ${REF}}"
        if [[ -n "$REF" ]]; then
            panel_run "$rel" git clone --depth 1 --branch "$REF" "$PANEL_REPO" "$rel"
        else
            panel_run "$rel" git clone --depth 1 "$PANEL_REPO" "$rel"
        fi
    fi

    # Shared state is wired BEFORE composer, not after.
    #
    # composer's post-autoload-dump hook runs `artisan package:discover`, which
    # boots Laravel and requires bootstrap/cache to exist and be writable — and
    # rsync deliberately excludes both bootstrap/cache and storage. Linking
    # afterwards means the very first composer run always dies with
    # "The …/bootstrap/cache directory must be present and writable."
    rm -rf "$rel/storage" "$rel/bootstrap/cache"
    install -d -o "$PANEL_USER" -g "$PANEL_USER" -m 0755 "${rel}/bootstrap"
    ln -sfn "${PANEL_SHARED}/.env" "${rel}/.env"
    ln -sfn "${PANEL_SHARED}/storage" "${rel}/storage"
    ln -sfn "${PANEL_SHARED}/bootstrap-cache" "${rel}/bootstrap/cache"

    panel_run "$rel" composer install -d "$rel" --no-dev --no-interaction \
        --prefer-dist --optimize-autoloader
    panel_run "$rel" npm --prefix "$rel" ci
    panel_run "$rel" npm --prefix "$rel" run build

    panel_run "$rel" php "$rel/artisan" migrate --force --no-interaction
    panel_run "$rel" php "$rel/artisan" optimize

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

    panel_run "$PANEL_CURRENT" php "${PANEL_CURRENT}/artisan" beacon:create-admin \
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

# ── Panel layout + release ──────────────────────────────────────────
# MySQL is configured *after* the panel, not before: configure_mysql writes
# BEACON_MYSQL_PASSWORD into the panel's .env, and that file is created by
# bootstrap_panel. Run in the old order and the write is silently skipped on a
# first install, leaving the panel with no database credentials.
if [[ "$SKIP_PANEL" -eq 0 ]]; then
    bootstrap_panel
fi

if [[ "$SKIP_MYSQL" -eq 0 ]]; then
    configure_mysql
fi

if [[ "$SKIP_PANEL" -eq 0 ]]; then
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

# The closing summary goes to the terminal as well as the log, but the
# generated password is written to the terminal only — a world-readable
# install log is the wrong place for a credential.
if [[ -f "${PANEL_CURRENT}/artisan" ]]; then
    if [[ -n "$DOMAIN" ]]; then
        scheme="http"
        [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]] && scheme="https"
        PANEL_URL="${scheme}://${DOMAIN}/"
    else
        PANEL_URL="https://$(panel_primary_ip):8443/"
    fi

    tty_out "\n${C_GREEN}${C_BOLD}  ✔ Beacon is ready${C_OFF}\n\n"
    tty_out "  ${C_DIM}url${C_OFF}       ${C_CYAN}${PANEL_URL}${C_OFF}\n"

    if [[ -n "$ADMIN_EMAIL" ]]; then
        tty_out "  ${C_DIM}login${C_OFF}     ${ADMIN_EMAIL}\n"

        if [[ "$GENERATED_PASSWORD" -eq 1 ]]; then
            tty_out "  ${C_DIM}password${C_OFF}  ${C_BOLD}${ADMIN_PASSWORD}${C_OFF}  ${C_YELLOW}← shown once, save it now${C_OFF}\n"
        fi
    else
        tty_out "  ${C_DIM}admin${C_OFF}     sudo -u ${PANEL_USER} php ${PANEL_CURRENT}/artisan beacon:create-admin\n"
    fi

    tty_out "\n"

    if [[ -z "$DOMAIN" ]]; then
        tty_out "  ${C_YELLOW}⚠${C_OFF} Self-signed certificate — your browser will warn once.\n"
        tty_out "    Attach a domain in Settings → Server for Let's Encrypt and\n"
        tty_out "    push-based GitHub deploys. Until then Beacon polls for changes.\n\n"
    fi

    tty_out "  ${C_DIM}Next: sign in, enable two-factor auth, then add your first site.${C_OFF}\n\n"

    echo "    Panel URL: ${PANEL_URL}"
else
    tty_out "\n  ${C_RED}✖ Panel bootstrap skipped or incomplete${C_OFF}\n"
    tty_out "    Check ${LOG}\n\n"
    echo "    Panel bootstrap skipped or incomplete — check ${LOG}"
fi
