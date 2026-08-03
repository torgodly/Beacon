<?php

namespace App\Services\Php;

use App\Jobs\InstallPhpVersion;
use App\Models\PhpVersion;
use App\Models\Server;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use Illuminate\Support\Facades\File;
use RuntimeException;

class PhpService
{
    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly PhpExtensionService $extensions,
        private readonly PhpIniService $ini,
    ) {}

    /**
     * Reconcile installed PHP versions on the host with the database.
     */
    public function sync(Server $server): void
    {
        $discovered = collect(File::glob('/etc/php/8.*'))
            ->map(fn (string $path): string => basename($path))
            ->filter(fn (string $version): bool => in_array($version, config('beacon.php_versions', []), true))
            ->values();

        foreach ($discovered as $version) {
            $record = PhpVersion::query()->updateOrCreate(
                ['server_id' => $server->id, 'version' => $version],
                [
                    'status' => 'installed',
                    'installed_at' => now(),
                    'is_default' => $version === $server->default_php_version,
                ],
            );

            if ($record->wasRecentlyCreated) {
                $record->update(['is_default' => $version === $server->default_php_version]);
            }

            $this->extensions->sync($record);
        }

        PhpVersion::query()
            ->where('server_id', $server->id)
            ->whereNotIn('version', $discovered->all())
            ->where('status', '!=', 'installing')
            ->update(['status' => 'missing']);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function list(Server $server): array
    {
        return array_values(PhpVersion::query()
            ->where('server_id', $server->id)
            ->with('extensions')
            ->orderBy('version')
            ->get()
            ->map(fn (PhpVersion $version): array => [
                'id' => $version->id,
                'version' => $version->version,
                'status' => $version->status,
                'is_default' => $version->is_default,
                'installed_at' => $version->installed_at?->toIso8601String(),
                'last_error' => $version->last_error,
                'extensions' => $version->status === 'installed'
                    ? $this->extensions->list($version)
                    : [],
                'ini' => $version->status === 'installed'
                    ? $this->ini->read($version)
                    : config('beacon.php_ini.defaults', []),
            ])
            ->all());
    }

    public function queueInstall(Server $server, string $version): PhpVersion
    {
        $this->assertSupported($version);

        $record = PhpVersion::query()->updateOrCreate(
            ['server_id' => $server->id, 'version' => $version],
            ['status' => 'installing', 'last_error' => null],
        );

        InstallPhpVersion::dispatch($record, 'install');

        return $record;
    }

    public function queueRemove(PhpVersion $phpVersion): void
    {
        $phpVersion->update(['status' => 'removing', 'last_error' => null]);
        InstallPhpVersion::dispatch($phpVersion, 'remove');
    }

    public function setDefault(Server $server, PhpVersion $phpVersion): void
    {
        abort_unless($phpVersion->server_id === $server->id, 404);
        abort_unless($phpVersion->status === 'installed', 422);

        PhpVersion::query()
            ->where('server_id', $server->id)
            ->update(['is_default' => false]);

        $phpVersion->update(['is_default' => true]);
        $server->update(['default_php_version' => $phpVersion->version]);
    }

    public function performInstall(PhpVersion $phpVersion): void
    {
        $result = $this->runner->sudoRoot(
            SudoWrapper::Package,
            ['php-install', $phpVersion->version],
            timeout: 600,
        );

        if ($result->failed()) {
            $phpVersion->update([
                'status' => 'failed',
                'last_error' => trim($result->combinedOutput()) ?: 'Install failed.',
            ]);

            return;
        }

        $phpVersion->update([
            'status' => 'installed',
            'installed_at' => now(),
            'last_error' => null,
        ]);

        $this->extensions->sync($phpVersion);
    }

    public function performRemove(PhpVersion $phpVersion): void
    {
        if ($phpVersion->is_default) {
            $phpVersion->update([
                'status' => 'installed',
                'last_error' => 'Cannot remove the server default PHP version.',
            ]);

            return;
        }

        $result = $this->runner->sudoRoot(
            SudoWrapper::Package,
            ['php-remove', $phpVersion->version],
            timeout: 600,
        );

        if ($result->failed()) {
            $phpVersion->update([
                'status' => 'installed',
                'last_error' => trim($result->combinedOutput()) ?: 'Remove failed.',
            ]);

            return;
        }

        $phpVersion->extensions()->delete();
        $phpVersion->settings()->delete();

        $phpVersion->update([
            'status' => 'missing',
            'installed_at' => null,
            'last_error' => null,
        ]);
    }

    private function assertSupported(string $version): void
    {
        if (! in_array($version, config('beacon.php_versions', []), true)) {
            throw new RuntimeException("PHP {$version} is not supported.");
        }
    }
}
