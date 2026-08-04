<?php

namespace App\Services\Php;

use App\Models\PhpExtension;
use App\Models\PhpVersion;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
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
        $available = collect(File::glob("/etc/php/{$version->version}/mods-available/*.ini"))
            ->map(fn (string $path): string => basename($path, '.ini'))
            ->values();

        $enabled = collect(File::glob("/etc/php/{$version->version}/fpm/conf.d/*.ini"))
            ->map(fn (string $path): string => (string) preg_replace('/^\d+-/', '', basename($path, '.ini')))
            ->filter()
            ->flip();

        foreach ($available->merge(array_keys(self::INSTALLABLE))->unique() as $name) {
            $version->extensions()->updateOrCreate(['name' => $name], [
                'label' => $name,
                'apt_package' => isset(self::INSTALLABLE[$name])
                    ? "php{$version->version}-".self::INSTALLABLE[$name]
                    : null,
                'is_installed' => $available->contains($name),
                'is_enabled' => $enabled->has($name),
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

        $extension->update(['is_installed' => true, 'is_enabled' => true]);
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
            throw new RuntimeException(
                "apt failed installing {$extension->apt_package}: {$result->combinedOutput()}",
            );
        }
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
}
