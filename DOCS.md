# Beacon Documentation

Production-oriented reference for installing, operating, and securing a Beacon panel.

## Installation

### One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/beacon-org/beacon/main/install.sh | sudo bash -s -- --domain panel.example.com --email admin@example.com
```

### Common options

| Flag | Purpose |
|------|---------|
| `--domain FQDN` | Panel hostname (Let's Encrypt on port 443) |
| `--email EMAIL` | ACME registration email |
| `--ref v1.0.0` | Git ref to deploy |
| `--admin-email EMAIL` | First admin user email |
| `--admin-password PASS` | First admin password (generated if omitted) |
| `--no-mysql` | Skip MySQL provisioning |

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
