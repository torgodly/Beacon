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

Beacon is secure **for its intended use** — a single trusted admin on a VPS you control. It is **not** multi-tenant RBAC. The gaps below are known trade-offs or areas worth hardening. Each includes impact and recommended action.

### 1. Compromised admin session = full host control

**Gap:** Any logged-in, verified user can deploy, edit nginx, run console commands, delete sites, update the panel, and manage databases. There are no roles.

**Impact:** Stolen session cookie or shared admin password gives complete server control — equivalent to root via wrappers.

**What to do:** Enable **2FA or passkeys** on your admin account. Use a strong unique password. Do not create extra admins unless necessary. Access the panel only over HTTPS with a real domain. Consider IP allow-listing at the firewall or Nginx if your IP is stable.

### 2. Web console runs arbitrary shell as `beacon`

**Gap:** The site console executes admin-entered commands through `/bin/bash -lc` as the `beacon` user (rate-limited, but not restricted by command).

**Impact:** A compromised admin (or mistake) can run any shell command allowed to `beacon` — read all site files, exfiltrate deploy keys, pivot between sites.

**What to do:** Treat the console like SSH. Only run commands you understand. Enable site isolation options. Do not share admin access. Optionally restrict console use via firewall if you rarely need it.

### 3. Cron jobs accept arbitrary commands

**Gap:** Crontab content is written via the panel with limited server-side validation of expressions or commands.

**Impact:** Malicious or malformed cron entries run on schedule as `beacon`.

**What to do:** Review cron entries after changes. Prefer Supervisor for long-running workers. Keep admin access locked down.

### 4. `open_basedir` is PHP-only and optional

**Gap:** Filesystem isolation applies to PHP-FPM only. It does not constrain shell, Node SSR, or deploy scripts. `strict_functions` defaults off. Sites share the `beacon` Unix user.

**Impact:** A compromised PHP app can still use shell functions (unless strict mode is on). A compromised Node or Laravel app can read other sites under `/home/beacon`.

**What to do:** Enable **open_basedir** and **strict_functions** per site under **Isolation**. Treat `open_basedir_extra_paths` carefully — only add paths you need. For strong separation between untrusted tenants, run separate servers or separate Unix users (not yet a first-class Beacon feature).

### 5. Session cookie may be sent over plain HTTP

**Gap:** Production panel env template sets `SESSION_ENCRYPT=true` but does not set `SESSION_SECURE_COOKIE=true`. If you reach the panel over HTTP, session cookies are not marked Secure-only.

**Impact:** Session hijack on untrusted networks if the panel is accessed without TLS.

**What to do:** **Always use HTTPS** with a valid certificate (attach a panel domain in Settings). After install, avoid the `:8443` self-signed fallback except for bootstrap. Optionally add `SESSION_SECURE_COOKIE=true` to panel `.env` once TLS is working.

### 6. No Content-Security-Policy on the panel

**Gap:** Panel Nginx configs set X-Frame-Options and related headers but not CSP.

**Impact:** Slightly weaker defense-in-depth against XSS in the panel UI (Laravel/React still escape output by default).

**What to do:** Low priority for a self-hosted admin tool. If you harden further, add a strict CSP to panel Nginx configs.

### 7. Destructive actions lack password re-confirmation

**Gap:** Site delete, panel update, env editor, nginx editor, and service restarts do not require typing your password again mid-session.

**Impact:** Faster accidental or session-hijack damage — one authenticated session is enough for destructive ops.

**What to do:** Keep sessions short (`SESSION_LIFETIME=120` default). Use 2FA. Log out on shared machines. Re-enable password confirmation in Fortify/config if you want that friction back.

### 8. Broad MySQL admin grants

**Gap:** `beacon_admin` can create databases and users (`WITH GRANT OPTION` on `*.*`) — required for the panel, but high blast radius if panel `.env` leaks.

**Impact:** Leaked panel credentials expose MySQL admin, not just one database.

**What to do:** Protect `/opt/beacon/panel/shared/.env` and SQLite backups. Restrict panel network access. Rotate MySQL password if `.env` is ever exposed. Backups use `MYSQL_PWD` briefly in the process list — run backups off-peak and restrict who can `ps` on the host.

### 9. GitHub webhook triggers deploy without panel login

**Gap:** `POST /webhooks/github` is unauthenticated but HMAC-verified. Anyone with the webhook secret can trigger deploys.

**Impact:** Leaked webhook secret → arbitrary deploy triggers (still runs your deploy script as `beacon`, not arbitrary code unless deploy script is malicious).

**What to do:** Rotate webhook secrets if compromised. Use GitHub's secret per installation. Restrict which repos/branches auto-deploy.

### 10. Self-signed panel on port 8443

**Gap:** Installer opens UFW for `:8443` with a self-signed cert when no domain is set.

**Impact:** MITM risk if you use IP-only access long term; users must verify certificate fingerprint manually.

**What to do:** Attach a real panel domain and Let's Encrypt cert as soon as possible. Close or stop using `:8443` after that.

### 11. Limited audit coverage for some actions

**Gap:** Web console commands, some service restarts, and panel updates are not always written to the activity log.

**Impact:** Harder forensic review after an incident.

**What to do:** Check Supervisor, Nginx, and deploy logs under `/var/log/beacon/` and Laravel logs. Consider enabling more verbose logging if you need stronger audit trails (future improvement).

### 12. Panel update accepts any semver tag

**Gap:** Panel self-update validates tag format (`vX.Y.Z`) but not a fixed allow-list of tags.

**Impact:** Any authed admin can deploy any matching tag from the configured repo.

**What to do:** Pin `BEACON_PANEL_REPO` to your fork if you want supply-chain control. Review releases before updating.

---

**Summary:** Beacon's strength is **wrapper-enforced privilege separation** and **single-admin auth hardening**. Its main risk is **trust in the admin account** and **shared `beacon` user between sites**. Guard the admin login, use TLS, enable 2FA, turn on PHP isolation for untrusted apps, and treat the console like root access to your sites.

---

## Documentation

See [DOCS.md](DOCS.md) for backup and restore, security architecture, panel updates, and production operations.

---

## License

MIT
