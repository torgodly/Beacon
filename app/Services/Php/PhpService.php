<?php

namespace App\Services\Php;

use App\Jobs\InstallPhpVersion;
use App\Models\PhpVersion;
use App\Models\Server;
use App\Services\Operations\OperationLog;
use App\Services\Operations\OperationRunner;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use App\Support\OutputStream\FileOutputStream;
use Illuminate\Support\Facades\File;
use RuntimeException;

class PhpService
{
    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly PhpExtensionService $extensions,
        private readonly PhpIniService $ini,
        private readonly OperationRunner $operations,
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
        $operation = $this->operations->start(
            type: 'php.install',
            title: "Install PHP {$phpVersion->version}",
            subject: $phpVersion,
            summary: 'apt-get install',
        );

        $log = new OperationLog(new FileOutputStream($operation->log_path));
        $log->step("Installing PHP {$phpVersion->version}");
        $log->muted("sudo beacon-pkg php-install {$phpVersion->version}");

        // apt is streamed line by line rather than buffered: a cold mirror or
        // a held dpkg lock can stall for minutes, and silence is the one thing
        // an operator cannot act on.
        $result = $this->runner->sudoRoot(
            SudoWrapper::Package,
            ['php-install', $phpVersion->version],
            timeout: 600,
            stream: $log,
        );

        if ($result->failed()) {
            $error = trim($result->combinedOutput()) ?: 'Install failed.';

            $phpVersion->update(['status' => 'failed', 'last_error' => $error]);
            $this->operations->finish($operation, 'failed', $result->exitCode() ?? 1, $error);
            $log->error("PHP {$phpVersion->version} install failed.");

            return;
        }

        $phpVersion->update([
            'status' => 'installed',
            'installed_at' => now(),
            'last_error' => null,
        ]);

        $log->step('Syncing extensions');
        $this->extensions->sync($phpVersion);
        $log->line(
            $phpVersion->extensions()->count().' extensions discovered.',
        );

        $this->operations->succeed($operation, $log);
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

        $operation = $this->operations->start(
            type: 'php.remove',
            title: "Remove PHP {$phpVersion->version}",
            subject: $phpVersion,
            summary: 'apt-get remove',
        );

        $log = new OperationLog(new FileOutputStream($operation->log_path));
        $log->step("Removing PHP {$phpVersion->version}");
        $log->muted("sudo beacon-pkg php-remove {$phpVersion->version}");

        $result = $this->runner->sudoRoot(
            SudoWrapper::Package,
            ['php-remove', $phpVersion->version],
            timeout: 600,
            stream: $log,
        );

        if ($result->failed()) {
            $error = trim($result->combinedOutput()) ?: 'Remove failed.';

            $phpVersion->update(['status' => 'installed', 'last_error' => $error]);
            $this->operations->finish($operation, 'failed', $result->exitCode() ?? 1, $error);
            $log->error("PHP {$phpVersion->version} removal failed.");

            return;
        }

        $this->operations->succeed($operation, $log);

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
