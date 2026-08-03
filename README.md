# Beacon

Beacon is a self-hosted server control panel for Laravel, PHP, and Node.js sites — inspired by Laravel Forge, but designed to run on a single VPS you own.

## Quick install

On Ubuntu 22.04/24.04 as root:

```bash
curl -fsSL https://raw.githubusercontent.com/beacon-org/beacon/main/install.sh | sudo bash -s -- --domain panel.example.com --email admin@example.com
```

Without a domain, the installer exposes the panel at `https://YOUR_IP:8443` with a self-signed certificate. Attach a real hostname later from **Settings → Server**.

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
