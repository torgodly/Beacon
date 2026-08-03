# Beacon

Beacon is a self-hosted server control panel for Laravel, PHP, and Node.js sites — inspired by Laravel Forge, but designed to run on a single VPS you own.

## Quick install

On Ubuntu 22.04/24.04 as root:

```bash
curl -fsSL https://raw.githubusercontent.com/beacon-org/beacon/main/install.sh | sudo bash
```

The installer is interactive — it asks how you want to reach the panel, sets up
your administrator account, and lets you pick which PHP and Node versions to
install. It shows you the full plan and waits for confirmation before touching
anything on the server.

Without a domain, the panel is exposed at `https://YOUR_IP:8443` with a
self-signed certificate; attach a real hostname later from **Settings → Server**.

### Unattended installs

Every question can be answered up front, which skips the prompt. Add `--yes` to
run with no interaction at all:

```bash
curl -fsSL .../install.sh | sudo bash -s -- \
  --domain panel.example.com \
  --email admin@example.com \
  --admin-email admin@example.com \
  --admin-password "$PANEL_PASSWORD" \
  --yes
```

Run `sudo bash install.sh --help` for the full list. If the password is omitted,
Beacon generates one and prints it once at the end.

## What you get

- Multi-site hosting with per-site PHP-FPM pools, Nginx vhosts, and SSL
- Git deploys (manual, poll, or GitHub webhooks) with live deployment logs
- Node/Bun runtimes, Supervisor workers, cron, databases, and a web console
- GitHub App integration for private repositories and push-to-deploy
- Activity logging, health checks (`beacon:doctor`), and scheduled backups

## Development

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
npm install
composer run dev
```

Run the full CI gate locally:

```bash
composer ci:check
```

## Documentation

See [DOCS.md](DOCS.md) for backup/restore, security architecture, and production operations.

## License

MIT
