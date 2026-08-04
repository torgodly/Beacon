<?php

namespace App\Services\Php;

use App\Models\PhpExtension;
use App\Models\PhpVersion;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use RuntimeException;

class PhpExtensionService
{
    /** @var array<string, string> */
    public const INSTALLABLE = [
        'redis' => 'redis',
        'imagick' => 'imagick',
        'gd' => 'gd',
        'bcmath' => 'bcmath',
        'pdo_mysql' => 'mysql',
        'pdo_pgsql' => 'pgsql',
        'intl' => 'intl',
        'zip' => 'zip',
        'swoole' => 'swoole',
        'mbstring' => 'mbstring',
        'curl' => 'curl',
        'xml' => 'xml',
        'soap' => 'soap',
        'sqlite3' => 'sqlite3',
        'apcu' => 'apcu',
        'memcached' => 'memcached',
        'igbinary' => 'igbinary',
        'xdebug' => 'xdebug',
    ];

    /** @var list<string> */
    public const LOCKED = [
        'json', 'openssl', 'mbstring', 'tokenizer', 'ctype', 'fileinfo', 'opcache',
    ];

    /** @var array<string, true> */
    private array $dirty = [];

    public function __construct(private readonly ProcessRunner $runner) {}

    public function sync(PhpVersion $version): void
    {
        $available = $this->availableModules($version);
        $enabled = $this->enabledModules($version);

        $names = $available
            ->merge(array_keys(self::INSTALLABLE))
            ->merge($enabled)
            ->map(fn (string $name): string => $this->normalizeModuleName($name))
            ->unique()
            ->values();

        foreach ($names as $name) {
            $version->extensions()->updateOrCreate(['name' => $name], [
                'label' => $name,
                'apt_package' => isset(self::INSTALLABLE[$name])
                    ? "php{$version->version}-".self::INSTALLABLE[$name]
                    : null,
                'is_installed' => $available->contains($name) || $enabled->contains($name),
                'is_enabled' => $enabled->contains($name),
                'is_core' => in_array($name, self::LOCKED, true),
                'last_synced_at' => now(),
            ]);
        }
    }

    public function enable(PhpExtension $extension): void
    {
        $version = $extension->phpVersion;

        if (! $extension->is_installed) {
            $this->install($extension);
        }

        $this->activate($extension);

        $extension->update([
            'is_installed' => true,
            'is_enabled' => true,
        ]);

        $this->sync($version);
        $this->markDirty($version);
    }

    public function disable(PhpExtension $extension): void
    {
        if ($extension->is_core) {
            throw new RuntimeException("{$extension->name} is required by Beacon and cannot be disabled.");
        }

        $result = $this->runner->sudoRoot(
            SudoWrapper::Php,
            ['ext-disable', $extension->phpVersion->version, $extension->name],
        );

        if ($result->failed()) {
            throw new RuntimeException("Could not disable {$extension->name}: {$result->errorOutput()}");
        }

        $extension->update(['is_enabled' => false]);

        $this->sync($extension->phpVersion);
        $this->markDirty($extension->phpVersion);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function list(PhpVersion $version): array
    {
        return array_values($version->extensions()
            ->orderBy('name')
            ->get()
            ->map(fn (PhpExtension $extension): array => [
                'id' => $extension->id,
                'name' => $extension->name,
                'label' => $extension->label ?? $extension->name,
                'is_installed' => $extension->is_installed,
                'is_enabled' => $extension->is_enabled,
                'is_core' => $extension->is_core,
                'installable' => array_key_exists($extension->name, self::INSTALLABLE),
            ])
            ->values()
            ->all());
    }

    private function install(PhpExtension $extension): void
    {
        if (! array_key_exists($extension->name, self::INSTALLABLE)) {
            throw new RuntimeException("{$extension->name} is not an installable extension.");
        }

        $aptSuffix = self::INSTALLABLE[$extension->name];

        $result = $this->runner->sudoRoot(
            SudoWrapper::Package,
            ['ext-install', $extension->phpVersion->version, $aptSuffix],
            timeout: 600,
        );

        if ($result->failed()) {
            throw new RuntimeException($this->formatInstallFailure(
                (string) $extension->apt_package,
                $result->combinedOutput(),
            ));
        }
    }

    private function formatInstallFailure(string $package, string $output): string
    {
        if (str_contains($output, 'Read-only file system')) {
            return "Could not install {$package}: the panel PHP sandbox blocks apt from writing "
                .'extension files under /usr/lib/php. Re-run install.sh or deploy the latest panel '
                .'release (which refreshes the systemd drop-in), then try again.';
        }

        $detail = trim($output);

        if (mb_strlen($detail) > 500) {
            $detail = mb_substr($detail, 0, 500).'…';
        }

        return "apt failed installing {$package}: {$detail}";
    }

    private function activate(PhpExtension $extension): void
    {
        $result = $this->runner->sudoRoot(
            SudoWrapper::Php,
            ['ext-enable', $extension->phpVersion->version, $extension->name],
        );

        if ($result->failed()) {
            throw new RuntimeException(
                "Could not enable {$extension->name} on PHP {$extension->phpVersion->version}: {$result->errorOutput()}",
            );
        }
    }

    private function markDirty(PhpVersion $version): void
    {
        if (isset($this->dirty[$version->version])) {
            return;
        }

        $this->dirty[$version->version] = true;

        app()->terminating(function () use ($version): void {
            $this->runner->sudoRoot(
                SudoWrapper::Php,
                ['fpm-restart', $version->version],
                timeout: 120,
            );
            unset($this->dirty[$version->version]);
        });
    }

    /** @return Collection<int, string> */
    private function availableModules(PhpVersion $version): Collection
    {
        return $this->normalizeModules(
            collect(File::glob("/etc/php/{$version->version}/mods-available/*.ini"))
                ->map(fn (string $path): string => basename($path, '.ini')),
        );
    }

    /** @return Collection<int, string> */
    private function enabledModules(PhpVersion $version): Collection
    {
        $fromPhp = $this->modulesFromPhpBinary($version);

        if ($fromPhp->isNotEmpty()) {
            return $fromPhp;
        }

        return $this->normalizeModules(
            collect(['cli', 'fpm'])
                ->flatMap(fn (string $sapi): array => File::glob("/etc/php/{$version->version}/{$sapi}/conf.d/*.ini") ?: [])
                ->map(fn (string $path): string => (string) preg_replace('/^\d+-/', '', basename($path, '.ini'))),
        );
    }

    /** @return Collection<int, string> */
    private function modulesFromPhpBinary(PhpVersion $version): Collection
    {
        $binary = $this->phpBinary($version);

        $result = $this->runner->run([$binary, '-m'], timeout: 30);

        if ($result->failed()) {
            return collect();
        }

        return $this->normalizeModules(
            collect(preg_split('/\r\n|\r|\n/', $result->output()) ?: [])
                ->map(fn (string $line): string => trim($line))
                ->filter(
                    fn (string $line): bool => $line !== '' && ! str_starts_with($line, '['),
                ),
        );
    }

    /** @param  Collection<int, string>  $modules */
    private function normalizeModules(Collection $modules): Collection
    {
        return $modules
            ->map(fn (string $name): string => $this->normalizeModuleName($name))
            ->filter()
            ->unique()
            ->values();
    }

    private function normalizeModuleName(string $name): string
    {
        return strtolower(trim($name));
    }

    private function phpBinary(PhpVersion $version): string
    {
        /** @var array<string, string> $overrides */
        $overrides = config('beacon.php.binaries', []);

        return $overrides[$version->version] ?? "/usr/bin/php{$version->version}";
    }
}
