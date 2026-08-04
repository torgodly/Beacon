<?php

namespace App\Services\Php;

use App\Models\Site;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use Illuminate\Support\Facades\View;
use RuntimeException;

class PhpPoolWriter
{
    /** @var array<string, true> */
    private array $pendingReloads = [];

    public function __construct(private readonly ProcessRunner $runner) {}

    public function write(Site $site): void
    {
        if (blank($site->php_version)) {
            return;
        }

        $extraPaths = $this->extraOpenBasedirPaths($site);
        $runAsUser = $site->runAsUser();

        $contents = View::make('php.pool', [
            'site' => $site,
            'runAsUser' => $runAsUser,
            'ini' => [
                'memory_limit' => '256M',
                'upload_max_filesize' => '100M',
                'post_max_size' => '100M',
                'max_execution_time' => '60',
            ],
            'extraPaths' => $extraPaths,
        ])->render();

        $this->guardPoolContents($contents);

        $result = $this->runner->sudoRoot(
            SudoWrapper::Php,
            ['pool-write', $site->name, $site->php_version],
            stdin: $contents,
        );

        if ($result->failed()) {
            throw new RuntimeException("Could not write PHP pool: {$result->errorOutput()}");
        }

        $this->scheduleFpmReload((string) $site->php_version);
    }

    public function delete(Site $site): void
    {
        if (blank($site->php_version)) {
            return;
        }

        $this->runner->sudoRoot(
            SudoWrapper::Php,
            ['pool-delete', $site->name, $site->php_version],
        );

        $this->scheduleFpmReload((string) $site->php_version);
    }

    /**
     * Reload after the HTTP response is sent.
     *
     * The panel itself runs inside php-fpm. Reloading the master from inside a
     * panel request recycles workers and can kill the worker handling the
     * create-site POST — nginx answers 502, the DB transaction rolls back, and
     * the operator sees a broken panel that "fixes itself" on refresh.
     */
    private function scheduleFpmReload(string $version): void
    {
        if (isset($this->pendingReloads[$version])) {
            return;
        }

        $this->pendingReloads[$version] = true;

        app()->terminating(function () use ($version): void {
            $this->runner->sudoRoot(SudoWrapper::Php, ['fpm-reload', $version], timeout: 120);
            unset($this->pendingReloads[$version]);
        });
    }

    private function extraOpenBasedirPaths(Site $site): string
    {
        $paths = collect($site->open_basedir_extra_paths ?? [])
            ->filter()
            ->map(fn (string $path): string => ':'.rtrim($path, '/'))
            ->implode('');

        return $paths;
    }

    private function guardPoolContents(string $contents): void
    {
        if (preg_match('/^user\s*=\s*(?:root\s*)?$/mi', $contents) === 1) {
            throw new RuntimeException('Refusing to write FPM pool with a missing or root user.');
        }
    }
}
