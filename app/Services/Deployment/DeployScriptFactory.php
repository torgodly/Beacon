<?php

namespace App\Services\Deployment;

use App\Models\Site;

class DeployScriptFactory
{
    public function forSite(Site $site): string
    {
        return match ($site->type) {
            'laravel' => $this->laravel(),
            'nextjs', 'nuxt', 'static' => $this->nodeBuild(),
            default => "#!/usr/bin/env bash\nset -euo pipefail\necho \"No default deploy script for {$site->type}\"\n",
        };
    }

    private function laravel(): string
    {
        return <<<'BASH'
#!/usr/bin/env bash
set -euo pipefail
cd "$BEACON_SITE_DIR"
$BEACON_COMPOSER install --no-interaction --prefer-dist --optimize-autoloader --no-dev
[ -f package.json ] && { $BEACON_NPM ci || $BEACON_NPM install; $BEACON_NPM run build; }
$BEACON_PHP artisan migrate --force
$BEACON_PHP artisan storage:link || true
$BEACON_PHP artisan optimize
$BEACON_PHP artisan queue:restart
BASH;
    }

    private function nodeBuild(): string
    {
        return <<<'BASH'
#!/usr/bin/env bash
set -euo pipefail
cd "$BEACON_SITE_DIR"
$BEACON_PM install --frozen-lockfile || $BEACON_PM install
$BEACON_PM run build
BASH;
    }
}
