<?php

namespace App\Services\Supervisor;

use App\Models\Site;
use App\Services\System\ProcessRunner;
use App\Services\System\SiteFilesystem;
use InvalidArgumentException;

/**
 * Generates the per-site launcher script that Supervisor execs for SSR apps.
 *
 * Supervisor's `environment=` directive is a single line with awkward `%`
 * escaping, so instead of cramming the runtime environment into the unit we
 * write a small, human-readable bash launcher and point Supervisor at that.
 * The trailing `exec` keeps the PID stable so Supervisor's SIGTERM reaches
 * Node directly rather than an npm/bun wrapper that would swallow it.
 */
class SsrLauncher
{
    public function __construct(
        private readonly SiteFilesystem $filesystem,
        private readonly ProcessRunner $runner,
    ) {}

    public static function supports(string $type): bool
    {
        return in_array($type, ['nextjs', 'nuxt'], true);
    }

    public function path(Site $site): string
    {
        return rtrim((string) config('beacon.paths.launchers'), '/')."/{$site->name}-ssr.sh";
    }

    /**
     * Write (or rewrite) the launcher for a site and return its path.
     */
    public function sync(Site $site): string
    {
        $path = $this->path($site);

        $this->filesystem->write($path, $this->script($site), 0750);

        return $path;
    }

    public function remove(Site $site): void
    {
        $this->runner->asSite(
            argv: ['/bin/rm', '-f', $this->path($site)],
            cwd: rtrim((string) config('beacon.paths.sites_home'), '/'),
        );
    }

    public function script(Site $site): string
    {
        if (! self::supports($site->type)) {
            throw new InvalidArgumentException("Site type [{$site->type}] does not run an SSR server.");
        }

        $nodeBin = $site->node_version
            ? "/usr/local/node/v{$site->node_version}/bin"
            : '/usr/local/node/default/bin';

        $port = $site->proxy_port ?? 3000;

        // Next.js honours -H/-p; Nuxt's Nitro output reads HOST/PORT from the
        // environment, which is already exported above the exec line.
        $exec = $site->type === 'nextjs'
            ? 'exec node_modules/.bin/next start -H "$HOST" -p "$PORT"'
            : 'exec node .output/server/index.mjs';

        return <<<BASH
        #!/usr/bin/env bash
        # {$site->name} — SSR launcher. Managed by Beacon; regenerated on runtime changes.
        set -euo pipefail
        umask 0002

        cd {$site->path}

        # Load the site's .env so the running server sees the same variables the
        # build did. `set -a` exports every assignment without touching the file.
        set -a
        [ -f .env ] && . ./.env
        set +a

        export PATH="{$nodeBin}:/usr/local/bun/default/bin:\$PATH"
        export NODE_ENV=production
        export HOST=127.0.0.1
        export PORT={$port}

        # exec → PID is preserved so Supervisor's SIGTERM reaches Node directly.
        {$exec}
        BASH;
    }
}
