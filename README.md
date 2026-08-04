<p align="center">
  <img src="./public/assets/images/logo.png" alt="Beacon" width="120" />
</p>

<h1 align="center">Beacon</h1>

<p align="center">
  Self-hosted server control panel for Laravel, PHP, and Node.js sites — inspired by Laravel Forge, built to run on a single VPS you own.
</p>

<p align="center">
  <a href="DOCS.md">Documentation</a>
  ·
  <a href="#development">Development</a>
  ·
  <a href="#license">License</a>
</p>

---

## Quick install

On Ubuntu 22.04 or 24.04 as root:

```bash
curl -fsSL https://raw.githubusercontent.com/torgodly/beacon/master/install.sh | sudo bash
```

The installer is interactive. It asks how you want to reach the panel, creates your administrator account, and lets you pick PHP and Node versions. It shows the full plan and waits for confirmation before changing anything on the server.

Without a domain, the panel is available at `https://YOUR_IP:8443` with a self-signed certificate. Attach a real hostname later from **Settings → Server**.

### Unattended installs

Every question can be answered up front. Add `--yes` to run with no interaction:

```bash
curl -fsSL https://raw.githubusercontent.com/torgodly/beacon/master/install.sh | sudo bash -s -- \
  --domain panel.example.com \
  --email admin@example.com \
  --admin-email admin@example.com \
  --admin-password "$PANEL_PASSWORD" \
  --yes
```

Run `sudo bash install.sh --help` for the full list of flags. If the password is omitted, Beacon generates one and prints it once at the end.

---

## What you get

- **Sites** — Nginx vhosts, per-site PHP-FPM pools, SSL, domains, and isolation controls
- **Deploys** — Git push, polling, or GitHub webhooks with live deployment logs
- **Runtimes** — PHP extensions, Node/Bun versions, Supervisor workers, and cron
- **Data** — MySQL databases, backups, and a site-scoped web console
- **Integrations** — GitHub App for private repos and push-to-deploy
- **Operations** — Activity logging, health checks (`beacon:doctor`), and scheduled backups

---

## Stack

| Layer | Technology |
|-------|------------|
| Backend | Laravel 13, Fortify, Inertia |
| Frontend | React 19, Tailwind CSS v4, TypeScript |
| Server | Nginx, PHP-FPM, MySQL, Redis, Supervisor |
| Panel DB | SQLite (shared state under `/opt/beacon/panel/shared`) |

---

## Development

Requirements: PHP 8.4+, Composer, Node.js 20+, and SQLite (or your configured database).

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
npm install
composer run dev
```

Create the first admin user:

```bash
php artisan beacon:create-admin
```

Run the full CI gate locally:

```bash
composer ci:check
```

---

## Security note

Beacon is a **single-admin server control panel**. It is designed so one trusted operator manages the whole host. Security is layered: guard that account, contain site workloads, and route every privileged action through audited wrappers instead of arbitrary shell as root.

### Authentication

- **Fortify** handles login, password reset, email verification, two-factor authentication (TOTP), and passkeys (WebAuthn).
- **Public registration is disabled** — admins are created only via `beacon:create-admin` (or the installer).
- **Login rate limiting** — 5 attempts per minute per email + IP; separate limits for 2FA and passkey endpoints.
- **Production password policy** — minimum 12 characters, mixed case, numbers, symbols, and Have I Been Pwned uncompromised check.

### Authorization model

- All panel routes (except the welcome page, health check, and GitHub webhook) require **`auth` + `verified`** middleware.
- There are **no roles or policies** — any authenticated admin can manage the entire server. This matches the single-operator model; do not create extra admin accounts unless you trust them completely.

### Privilege separation (`beacon-panel` vs `beacon`)

| User | Runs | Sudo |
|------|------|------|
| `beacon-panel` | Laravel panel, queue worker, scheduled tasks | Limited — only to fixed wrapper scripts under `/opt/beacon/bin/wrappers/` |
| `beacon` | Site files, deploys, FPM pools, cron, Supervisor workers | **None** |

The panel never runs site commands as root directly. Root-only work (Nginx reload, Certbot, FPM restart, package installs) goes through **validated wrapper scripts** invoked via `ProcessRunner` with stdin payloads — not free-form `sudo` commands.

### Wrapper hardening

Each wrapper validates input against allow-lists before acting:

- **`beacon-run`** — JSON stdin; working directory restricted to `/home/beacon`; uses `execvpe` (no shell).
- **`beacon-fs`** — Path canonicalization; rejects anything outside `/home/beacon`.
- **`beacon-nginx`** — Site name validation; reserved vhost guard; `nginx -t` before apply; config on stdin.
- **`beacon-supervisor`** — Rejects `user=root`; enforces `user=beacon`; command path prefix checks.
- **`beacon-service`** — Systemd unit allow-list (mirrors `config/beacon.php`).
- **`beacon-php`** — Version/site/pool validation; FPM config test before reload.
- **`beacon-cron`** — Read/write crontab for the `beacon` user only.
- **`beacon-certbot`** — Email and domain validation.

Sudoers grants **exact wrapper paths only** (`env_reset`, `secure_path`). Wrapper invocations are covered by automated guard tests.

### Deployment security

- **Per-site deploy mutex** — `Cache::lock()` prevents concurrent deploys on the same site.
- **Deploy rate limit** — 10 deploys per minute per user.
- **Deploy scripts** run as `beacon` via `beacon-run`, not as root.
- **Legacy script refresh** — Unsafe or outdated default scripts are auto-rewritten on preflight.
- **Site deletion** requires typing the exact site name; blocked while a deploy is active.
- **Post-deploy permissions** — Directories `2775`, files `0664`, `.env` at `0640`, storage paths tightened; npm bin stubs restored for SSR.

### Site isolation

- **Per-site Nginx vhosts** — Generated configs; custom edits are flagged so Beacon does not overwrite them silently.
- **Per-site PHP-FPM pools** — Optional `open_basedir` (default on for new sites) and `strict_functions` / `disable_functions` hardening.
- **Per-site temp paths** — Upload, session, and sys temp dirs scoped under the site tree.
- **systemd sandbox drop-ins** — Optional `ReadWritePaths` restrictions for FPM and Supervisor.
- **Supervisor and cron** always run as `beacon`, never root.

### Network and TLS

- **UFW** (when available) — SSH, HTTP, HTTPS, and panel fallback port; MySQL bound to localhost only.
- **TLS 1.2/1.3**, modern cipher suites, `server_tokens off` on Nginx.
- **Security headers** on panel vhosts — `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`.
- **HSTS** on site TLS vhosts; catch-all default server drops unmatched HTTP.
- **Let's Encrypt** issuance via the `beacon-certbot` wrapper.

### Database and credentials

- **MySQL** — `bind-address=127.0.0.1`, `local_infile` off, `secure_file_priv` disabled.
- **`beacon_admin@localhost` only** — Grants exclude dangerous privileges (FILE, PROCESS, SUPER, etc.).
- **SQL identifier validation** — Database and user names validated with strict regex before any DDL.
- **Panel database** — SQLite with WAL; `.env` and DB files at restrictive permissions on install.
- **Backup downloads** — Signed URLs plus authentication.

### Secrets and integrations

- **Install-time generation** — `APP_KEY`, MySQL password; MySQL admin secret stored at `/root/.beacon-mysql-admin` (`0600`).
- **Deploy environment** — Secrets passed via env vars to deploy scripts, not echoed in logs.
- **GitHub webhooks** — HMAC-SHA256 signature verification with `hash_equals`; CSRF exempt only for this route.
- **GitHub OAuth** — Random state token in cache, single use, 1-hour TTL.

### Sessions, CSRF, and throttling

- **CSRF** on all state-changing web routes (except the verified GitHub webhook).
- **Database-backed sessions** with encryption enabled in production template; `http_only`, `same_site=lax`.
- **Console commands** throttled to 30 per minute per user/IP.
- **Password updates** throttled on settings routes.

### Audit and operations

- **Activity logging** — Site create/delete, deploys, SSL, nginx, cron, supervisor, database, and env changes recorded with IP and user agent.
- **`beacon:doctor`** — Health checks; strict mode verifies wrappers, sudoers, disk, swap, and that `beacon` has no sudo.
- **Security test suite** — Wrapper guard tests, destructive-invocation tests, MySQL hardening tests, auth tests.

For deeper architecture (wrappers, isolation, health checks), see [Security architecture in DOCS.md](DOCS.md#security-architecture).

---

## Security gaps

Concrete issues in the current codebase — things Beacon should fix, not generic admin advice.

### Crontab lines built without field validation

**Where:** `StoreCronJobRequest` only checks string length. `CronService::buildManagedBlock()` writes `{expression} {command} {output_redirect}` straight into the `beacon` crontab.

**Fix:** Validate cron expressions with a parser (e.g. reject invalid fields). Restrict `command` and `output_redirect` to safe character sets; reject unquoted shell metacharacters.

**Impact:** A bad or crafted cron entry runs arbitrary shell as `beacon` on a schedule.

### `open_basedir_extra_paths` accepts any path

**Where:** `UpdateSiteIsolationRequest` allows any string up to 255 chars. `PhpPoolWriter::extraOpenBasedirPaths()` appends those paths verbatim into `php_admin_value[open_basedir]`.

**Fix:** Allow-list paths (site root subdirs, `/usr/share/php`, etc.). Reject `..`, paths outside `/home/beacon/{site}`, and system paths like `/etc` or `/root`.

**Impact:** A site with isolation “enabled” can still widen PHP filesystem access to other tenants or system files.

### `SESSION_SECURE_COOKIE` missing from shipped panel env

**Where:** `deploy/env/panel.env` sets `SESSION_ENCRYPT=true` but never sets `SESSION_SECURE_COOKIE`. `config/session.php` falls back to `null` (not Secure).

**Fix:** Add `SESSION_SECURE_COOKIE=true` to `deploy/env/panel.env` (and set it when attaching a TLS panel domain).

**Impact:** Session cookies are not marked Secure-only; cleartext HTTP panel access can expose them.

### Database passwords sent to the browser

**Where:** `DatabaseBackupService::connectionStrings()` returns plaintext passwords in Laravel env snippets, URLs, and TablePlus links. `DatabaseController` passes this to Inertia.

**Fix:** Mask by default; reveal or copy via a one-time server action instead of embedding credentials in page props.

**Impact:** Passwords sit in Inertia JSON, browser devtools, and any XSS in the panel leaks every DB user on that page load.

### `MYSQL_PWD` exposed in process list during backups

**Where:** `DatabaseBackupService` passes the admin password through the `MYSQL_PWD` environment variable when running `mysqldump`.

**Fix:** Use `mysqldump --defaults-extra-file=` with a mode-`0600` temp file (or socket auth where possible).

**Impact:** Anyone who can run `ps` on the host sees MySQL credentials while a backup job runs.

### Console runs not in the activity log

**Where:** `SiteCommandService` stores commands in `site_commands` but never calls `$site->activity()->log()`. Cron, nginx, deploy, and env changes are logged; console is not.

**Fix:** Log `console.ran` (command text or a hash) when a command starts or finishes.

**Impact:** The Activity feed is incomplete for forensics; console use is only in per-command log files.

### GitHub webhook verifies against every installation

**Where:** `VerifyGitHubSignature::matchingInstallation()` loops all `GithubInstallation` rows and HMAC-compares each secret on every webhook.

**Fix:** Parse `installation.id` (or `repository.id`) from the payload first; verify only that installation’s secret.

**Impact:** Wasted work on busy hosts; harder to rate-limit per installation; unnecessary secret comparisons on each request.

### `strict_functions` off by default

**Where:** `database/migrations/..._create_beacon_sites_tables.php` defaults `open_basedir` to `true` but `strict_functions` to `false`.

**Fix:** Default `strict_functions` to `true` for new sites, or enable it automatically when `open_basedir` is on.

**Impact:** PHP sites get directory restrictions but still have `exec`, `shell_exec`, `proc_open`, etc. unless an admin finds and toggles strict mode.

### High-impact routes not rate-limited

**Where:** `routes/web.php` throttles deploy (`throttle:deploy`) and console (`throttle:console`) only. Site delete, database delete, nginx write, SSL issue, and panel update have no throttle middleware.

**Fix:** Add a shared `throttle:destructive` (or per-route limits) on destructive endpoints.

**Impact:** No application-level backoff on rapid destructive requests.

### Panel Nginx configs have no Content-Security-Policy

**Where:** `deploy/nginx/beacon-panel.conf` and `beacon-panel-8443.conf` set `X-Frame-Options` / `X-Content-Type-Options` but no `Content-Security-Policy` header.

**Fix:** Add a strict CSP compatible with Vite/Inertia assets.

**Impact:** Weaker defense-in-depth if a stored-XSS or injected script ever reaches the panel HTML.

### Custom nginx editor only checks length

**Where:** `UpdateSiteNginxRequest` validates `contents` with `max:65535` only. The `beacon-nginx` wrapper runs `nginx -t` but does not restrict directive content.

**Fix:** Optional: block obvious footguns (`proxy_pass` to metadata IPs, `include /etc/*`, etc.) before apply; at minimum document that custom nginx is full trust.

**Impact:** A mistaken config can open internal proxies or break TLS/isolation at the edge — caught by `nginx -t` for syntax, not intent.

---

These are tracked gaps for future Beacon releases. PRs welcome on the items above.

---

## Documentation

See [DOCS.md](DOCS.md) for backup and restore, security architecture, panel updates, and production operations.

---

## License

MIT
