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
        $script = match (true) {
            $site->type === 'static'
                && $this->normalize($site->deploy_script) === $this->normalize($this->legacyStaticBuild()) => $this->forSite($site),
            $site->type === 'laravel'
                && (
                    $this->runsArtisanBeforeComposer($site->deploy_script)
                    || $this->usesUnsafeEnvWriter($site->deploy_script)
                ) => $this->forSite($site),
            default => null,
        };

        if ($script === null) {
            return false;
        }

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

# ── Environment bootstrap ─────────────────────────────────────────────
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
  else
    cat > .env <<ENV
APP_NAME="${BEACON_SITE}"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL="https://${BEACON_SITE}"

LOG_CHANNEL=stack
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=
DB_USERNAME=
DB_PASSWORD=

BROADCAST_CONNECTION=log
CACHE_STORE=file
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database
SESSION_DRIVER=file
SESSION_LIFETIME=120
ENV
  fi
fi

set_env_var() {
  local key="$1"
  local env_source="${2:-}"
  local literal_value="${3-}"
  [ -f .env ] || return 0
  BEACON_ENV_KEY="$key" BEACON_ENV_SOURCE="$env_source" BEACON_ENV_VALUE="$literal_value" "$BEACON_PHP" -r '
    $key = getenv("BEACON_ENV_KEY") ?: "";
    $source = getenv("BEACON_ENV_SOURCE") ?: "";
    if ($key === "" || ! is_file(".env")) { exit(0); }
    if ($source !== "") {
        $raw = getenv($source);
        $value = $raw === false ? "" : $raw;
    } else {
        $value = getenv("BEACON_ENV_VALUE") ?: "";
    }
    $format = static function (string $value): string {
        if ($value === "") { return "\"\""; }
        if (preg_match("/^[A-Za-z0-9_.@:-]+$/", $value)) { return $value; }
        return "\"".addcslashes($value, "\\\"\$\0")."\"";
    };
    $lines = file(".env", FILE_IGNORE_NEW_LINES);
    if ($lines === false) { exit(1); }
    $formatted = $key."=".$format($value);
    $found = false;
    foreach ($lines as $index => $line) {
      if (str_starts_with($line, $key."=")) {
        $lines[$index] = $formatted;
        $found = true;
        break;
      }
    }
    if (! $found) {
      $lines[] = $formatted;
    }
    file_put_contents(".env", implode("\n", $lines)."\n");
  '
}

if [ -n "${BEACON_SITE:-}" ]; then
  set_env_var APP_NAME BEACON_SITE
  set_env_var APP_URL "" "https://${BEACON_SITE}"
fi

if [ -n "${BEACON_APP_ENV:-}" ]; then
  set_env_var APP_ENV BEACON_APP_ENV
  if [ "${BEACON_APP_ENV}" = "testing" ]; then
    set_env_var APP_DEBUG "" true
  else
    set_env_var APP_DEBUG "" false
  fi
fi

if [ "${BEACON_DB_DRIVER:-mysql}" = "sqlite" ]; then
  set_env_var DB_CONNECTION "" sqlite
  sqlite_path="${BEACON_DB_SQLITE_PATH:-${BEACON_SITE_DIR}/database/database.sqlite}"
  set_env_var DB_DATABASE "" "${sqlite_path}"
  mkdir -p "$(dirname "${sqlite_path}")"
  touch "${sqlite_path}"
elif [ -n "${BEACON_DB_DATABASE:-}" ]; then
  set_env_var DB_CONNECTION "" mysql
  set_env_var DB_HOST BEACON_DB_HOST
  set_env_var DB_PORT BEACON_DB_PORT
  set_env_var DB_DATABASE BEACON_DB_DATABASE
  set_env_var DB_USERNAME BEACON_DB_USERNAME
  set_env_var DB_PASSWORD BEACON_DB_PASSWORD
fi

if [ "${BEACON_REDIS_ENABLED:-false}" = "true" ]; then
  set_env_var CACHE_STORE "" redis
  set_env_var QUEUE_CONNECTION "" redis
  set_env_var SESSION_DRIVER "" redis
  set_env_var REDIS_HOST BEACON_REDIS_HOST
  set_env_var REDIS_PORT BEACON_REDIS_PORT
else
  set_env_var CACHE_STORE "" file
  set_env_var QUEUE_CONNECTION "" database
  set_env_var SESSION_DRIVER "" file
fi

# ── Dependencies & build ──────────────────────────────────────────────
$BEACON_COMPOSER install --no-interaction --prefer-dist --optimize-autoloader

if [ -f package.json ]; then
  $BEACON_PM ci || $BEACON_PM install
  $BEACON_PM run build
fi

$BEACON_COMPOSER install --no-dev --no-interaction --prefer-dist --optimize-autoloader

# ── Laravel housekeeping ──────────────────────────────────────────────
if [ -f artisan ]; then
  if ! grep -qE '^APP_KEY=base64:' .env 2>/dev/null; then
    $BEACON_PHP artisan key:generate --force
  fi
  $BEACON_PHP artisan config:clear
  $BEACON_PHP artisan migrate --force
  $BEACON_PHP artisan storage:link || true
  $BEACON_PHP artisan optimize:clear
  $BEACON_PHP artisan optimize
  $BEACON_PHP artisan queue:restart
fi
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

    private function runsArtisanBeforeComposer(?string $script): bool
    {
        $script = (string) $script;
        $artisanPos = strpos($script, 'artisan key:generate');
        $firstComposerPos = strpos($script, '$BEACON_COMPOSER install');

        if ($artisanPos === false || $firstComposerPos === false) {
            return false;
        }

        $secondComposerPos = strpos(
            $script,
            '$BEACON_COMPOSER install --no-dev',
            $firstComposerPos + 1,
        );

        $composerPos = $secondComposerPos !== false
            ? $secondComposerPos
            : $firstComposerPos;

        return $artisanPos < $composerPos;
    }

    private function usesUnsafeEnvWriter(?string $script): bool
    {
        $script = (string) $script;

        return str_contains($script, 'set_env_var DB_PASSWORD "${BEACON_DB_PASSWORD')
            || (
                str_contains($script, 'set_env_var DB_PASSWORD')
                && ! str_contains($script, 'set_env_var DB_PASSWORD BEACON_DB_PASSWORD')
            );
    }
}
