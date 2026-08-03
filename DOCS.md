# Beacon Documentation

Production-oriented reference for installing, operating, and securing a Beacon panel.

## Installation

### One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/beacon-org/beacon/main/install.sh | sudo bash
```

The installer is a guided wizard. It runs its preflight checks first, then asks:

1. **How will you reach the panel?** — a domain (Let's Encrypt, push webhooks)
   or the server IP on `:8443` (self-signed, poll-based deploys).
2. **Administrator account** — name, login email and password. Leave the
   password blank and Beacon generates a 24-character one, shown once at the end.
3. **Runtimes and services** — which PHP versions to install, the default Node
   major, and whether to install MySQL.

It then prints the complete plan and waits for confirmation. Nothing on the
server is modified until you say yes, and `Ctrl-C` before that point is safe.

Prompts are read from `/dev/tty`, so the wizard works correctly even when the
script itself arrives on stdin through a `curl … | sudo bash` pipe.

### Unattended installs

Supplying an answer as a flag skips its question. `--yes` disables prompting
entirely and accepts the default for anything still unset — which means no
domain, all supported PHP versions, and MySQL installed. The installer also
detects a missing TTY and switches to this mode on its own.

```bash
sudo bash install.sh \
  --domain panel.example.com --email admin@example.com \
  --admin-email admin@example.com --admin-password "$PANEL_PASSWORD" \
  --php "8.3 8.4" --node 22 --yes
```

### Common options

| Flag | Purpose |
|------|---------|
| `--domain FQDN` | Panel hostname (Let's Encrypt on port 443) |
| `--email EMAIL` | ACME registration email |
| `--ref v1.0.0` | Git ref to deploy |
| `--admin-email EMAIL` | First admin user email |
| `--admin-password PASS` | First admin password (generated if omitted) |
| `--php "8.3 8.4"` | PHP versions to install (default: all supported) |
| `--node 22` | Default Node major version |
| `--no-mysql` | Skip MySQL provisioning |
| `-y`, `--yes` | Never prompt; accept defaults for anything unset |
| `-h`, `--help` | Show all options |

### IP-only install

Omit `--domain` to bind the panel to `https://SERVER_IP:8443` with a self-signed certificate. After DNS is ready, open **Settings → Server → Attach panel domain** to migrate to a public hostname with Let's Encrypt on port 443.

### What the installer provisions

- OS users `beacon` (site workloads) and `beacon-panel` (panel process)
- PHP 8.1–8.4, Node.js 20/22/24, Bun, Nginx, MySQL (optional), Redis, Supervisor
- Sudo wrappers under `/opt/beacon/bin/wrappers/` and matching sudoers entries
- Panel release at `/opt/beacon/panel/current` with shared state in `/opt/beacon/panel/shared`
- SQLite panel database and systemd units for the panel and queue worker

---

## Backup and restore

### Automated backups

Beacon schedules a weekly backup (Mondays 03:00 server time):

```bash
php artisan schedule:list   # verify beacon:backup is scheduled
```

### Manual backup

```bash
sudo -u beacon-panel php /opt/beacon/panel/current/artisan beacon:backup
```

By default this writes to `storage/app/backups/YYYY-MM-DD-HHMMSS/` containing:

| File | Contents |
|------|----------|
| `beacon.sqlite` | Panel SQLite database (sites, settings, deployments, etc.) |
| `panel.env` | Panel `.env` snapshot from `/opt/beacon/panel/shared/.env` |

Custom output directory:

```bash
php artisan beacon:backup --output=/var/backups/beacon/$(date +%F)
```

### Restore procedure

1. **Stop the panel** (optional but recommended during restore):

   ```bash
   sudo systemctl stop beacon-panel beacon-panel-worker
   ```

2. **Restore the database**:

   ```bash
   cp /path/to/backup/beacon.sqlite /opt/beacon/panel/shared/database/database.sqlite
   chown beacon-panel:beacon-panel /opt/beacon/panel/shared/database/database.sqlite
   ```

3. **Restore environment** (if backed up):

   ```bash
   cp /path/to/backup/panel.env /opt/beacon/panel/shared/.env
   chown beacon-panel:beacon-panel /opt/beacon/panel/shared/.env
   chmod 640 /opt/beacon/panel/shared/.env
   ```

4. **Clear caches and restart**:

   ```bash
   sudo -u beacon-panel php /opt/beacon/panel/current/artisan config:clear
   sudo -u beacon-panel php /opt/beacon/panel/current/artisan cache:clear
   sudo systemctl start beacon-panel beacon-panel-worker
   ```

Site files, MySQL data, and TLS certificates live **outside** the panel SQLite backup. Include `/home/beacon`, database dumps, and `/etc/letsencrypt` in your broader server backup strategy.

---

## Security architecture

Beacon separates **who runs the panel** from **who runs your sites**. The panel never executes site commands as root directly — it delegates through audited wrapper scripts.

### User split: `beacon-panel` vs `beacon`

| User | Role | Sudo |
|------|------|------|
| `beacon-panel` | Runs the Laravel panel, queue worker, and scheduled tasks | Limited — only to `/opt/beacon/bin/wrappers/*` |
| `beacon` | Owns site directories, FPM pools, deploy scripts, cron, Supervisor programs | **None** |

Site deploys, console commands, and git operations always run as `beacon`. The panel process runs as `beacon-panel` and invokes root-only operations (Nginx reload, certbot, FPM restart) through wrappers.

### Sudo wrappers

Root wrappers live in `/opt/beacon/bin/wrappers/` (e.g. `beacon-nginx`, `beacon-certbot`, `beacon-php`, `beacon-supervisor`). Each wrapper:

- Validates arguments against fixed allow-lists (no arbitrary shell input)
- Logs invocations under `/var/log/beacon/`
- Is the **only** path granted in `/etc/sudoers.d/beacon-panel`

The panel's `ProcessRunner` enforces this boundary — application code cannot call `sudo` with free-form commands.

### PHP isolation (`open_basedir`)

Per-site FPM pools can restrict filesystem access with `open_basedir`:

- Enabled by default for new sites (configurable per site under **Isolation**)
- Restricts PHP to the site root, system temp, and explicitly allowed extra paths
- Optional `disable_functions` hardening for strict mode

Nginx vhosts are generated per site; customized configs are marked so Beacon does not overwrite manual edits.

### Panel exposure

- Production installs should use a dedicated panel subdomain with valid TLS
- GitHub webhooks require a publicly reachable HTTPS URL (not IP-only)
- Destructive settings (panel domain attach, panel updates, password changes) require recent password confirmation

### Health verification

```bash
sudo -u beacon-panel php /opt/beacon/panel/current/artisan beacon:doctor
```

Strict mode (`BEACON_HEALTH_STRICT=true`) additionally checks wrapper binaries, sudoers files, swap, and disk thresholds.

---

## Deploy environment variables

Deploy scripts receive Beacon-injected variables (also listed in the panel beside the script editor):

| Variable | Description |
|----------|-------------|
| `$BEACON_SITE` | Primary domain / site name |
| `$BEACON_SITE_DIR` | Absolute site root |
| `$BEACON_BRANCH` | Tracked Git branch |
| `$BEACON_PHP` | Site PHP binary |
| `$BEACON_NODE` / `$BEACON_NPM` / `$BEACON_NPX` | Node toolchain |
| `$BEACON_BUN` / `$BEACON_PM` | Bun and preferred package manager |
| `$BEACON_PORT` | Local SSR proxy port |
| `$CI`, `$NODE_ENV`, `$PATH`, `$HOME`, `$USER` | Standard build context |

---

## Useful commands

| Command | Purpose |
|---------|---------|
| `beacon:doctor` | Host and runtime health checks |
| `beacon:backup` | SQLite + `.env` snapshot |
| `beacon:create-admin` | Create or reset an admin user |
| `php artisan schedule:work` | Run scheduled tasks (metrics, pruning, backups) |

---

## Upgrading

Use **Settings → Updates** in the panel, or on the server:

```bash
sudo /opt/beacon/bin/wrappers/beacon-update
```

Keep at least one previous release under `/opt/beacon/panel/releases/` for rollback from the panel UI.
