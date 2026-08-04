<?php

namespace App\Services\Deployment;

use App\Models\Site;
use App\Services\System\SiteFilesystem;

class DeployScriptFactory
{
    public function forSite(Site $site): string
    {
        return match ($site->type) {
            'laravel' => $this->laravel(),
            'static' => $this->static(),
            'nextjs', 'nuxt' => $this->ssrBuild(),
            default => "#!/usr/bin/env bash\nset -euo pipefail\necho \"No default deploy script for {$site->type}\"\n",
        };
    }

    /**
     * Static sites used to share the SSR build script, which always ran npm even
     * when the repository was plain HTML. Refresh untouched legacy scripts on
     * deploy so existing sites pick up the conditional build without manual edits.
     */
    public function refreshLegacyDefault(Site $site, SiteFilesystem $filesystem): bool
    {
        if ($site->type !== 'static') {
            return false;
        }

        if ($this->normalize($site->deploy_script) !== $this->normalize($this->legacyStaticBuild())) {
            return false;
        }

        $script = $this->forSite($site);
        $site->update(['deploy_script' => $script]);
        $filesystem->write($site->deployScriptPath(), $script, 0700);

        return true;
    }

    private function laravel(): string
    {
        return <<<'BASH'
#!/usr/bin/env bash
set -euo pipefail
cd "$BEACON_SITE_DIR"
$BEACON_COMPOSER install --no-interaction --prefer-dist --optimize-autoloader --no-dev
[ -f package.json ] && { $BEACON_PM ci || $BEACON_PM install; $BEACON_PM run build; }
$BEACON_PHP artisan migrate --force
$BEACON_PHP artisan storage:link || true
$BEACON_PHP artisan optimize
$BEACON_PHP artisan queue:restart
BASH;
    }

    private function static(): string
    {
        return <<<'BASH'
#!/usr/bin/env bash
set -euo pipefail
cd "$BEACON_SITE_DIR"
if [ -f package.json ]; then
  $BEACON_PM install --frozen-lockfile || $BEACON_PM install
  $BEACON_PM run build
else
  echo "No package.json — serving checked-out files as-is."
fi
BASH;
    }

    private function ssrBuild(): string
    {
        return <<<'BASH'
#!/usr/bin/env bash
set -euo pipefail
cd "$BEACON_SITE_DIR"
if [ ! -f package.json ]; then
  echo "Error: package.json not found. Check the repository URL and site type." >&2
  exit 1
fi
$BEACON_PM install --frozen-lockfile || $BEACON_PM install
$BEACON_PM run build
BASH;
    }

    /** @deprecated Legacy default shared by static sites before conditional builds. */
    private function legacyStaticBuild(): string
    {
        return <<<'BASH'
#!/usr/bin/env bash
set -euo pipefail
cd "$BEACON_SITE_DIR"
$BEACON_PM install --frozen-lockfile || $BEACON_PM install
$BEACON_PM run build
BASH;
    }

    private function normalize(?string $script): string
    {
        return str_replace("\r\n", "\n", trim((string) $script));
    }
}
