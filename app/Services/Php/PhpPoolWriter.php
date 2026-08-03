<?php

namespace App\Services\Php;

use App\Models\Site;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use Illuminate\Support\Facades\View;
use RuntimeException;

class PhpPoolWriter
{
    public function __construct(private readonly ProcessRunner $runner) {}

    public function write(Site $site): void
    {
        if (blank($site->php_version)) {
            return;
        }

        $extraPaths = $this->extraOpenBasedirPaths($site);

        $contents = View::make('php.pool', [
            'site' => $site,
            'ini' => [
                'memory_limit' => '256M',
                'upload_max_filesize' => '100M',
                'post_max_size' => '100M',
                'max_execution_time' => '60',
            ],
            'extraPaths' => $extraPaths,
        ])->render();

        $result = $this->runner->sudoRoot(
            SudoWrapper::Php,
            ['pool-write', $site->name, $site->php_version],
            stdin: $contents,
        );

        if ($result->failed()) {
            throw new RuntimeException("Could not write PHP pool: {$result->errorOutput()}");
        }

        $this->runner->sudoRoot(SudoWrapper::Php, ['fpm-restart', $site->php_version], timeout: 120);
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

        $this->runner->sudoRoot(SudoWrapper::Php, ['fpm-restart', $site->php_version], timeout: 120);
    }

    private function extraOpenBasedirPaths(Site $site): string
    {
        $paths = collect($site->open_basedir_extra_paths ?? [])
            ->filter()
            ->map(fn (string $path): string => ':'.rtrim($path, '/'))
            ->implode('');

        return $paths;
    }
}
