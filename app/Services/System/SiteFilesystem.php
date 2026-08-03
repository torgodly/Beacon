<?php

namespace App\Services\System;

use RuntimeException;

/**
 * Panel-side reads/writes inside `/home/beacon` (site `.env`, deploy scripts,
 * Supervisor log tails, ...), proxied through the unprivileged `beacon-fs`
 * wrapper (`sudo -u beacon`, zero argv — the whole job spec travels on stdin).
 *
 * `beacon-fs` canonicalises the requested path and rejects anything that
 * escapes the site tree before touching disk; this class only shapes the
 * request and surfaces failures as exceptions.
 */
class SiteFilesystem
{
    public function __construct(private readonly ProcessRunner $runner) {}

    public function read(string $path): string
    {
        return $this->invoke('read', ['path' => $path])->output();
    }

    public function write(string $path, string $contents, int $mode = 0644): void
    {
        $this->invoke('write', ['path' => $path, 'mode' => $mode, 'contents' => $contents]);
    }

    /**
     * @return array<string, mixed>
     */
    public function stat(string $path): array
    {
        $output = $this->invoke('stat', ['path' => $path])->output();

        /** @var array<string, mixed> $decoded */
        $decoded = json_decode($output, true, flags: JSON_THROW_ON_ERROR);

        return $decoded;
    }

    public function tail(string $path, int $lines = 200): string
    {
        return $this->invoke('tail', ['path' => $path, 'lines' => $lines])->output();
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function invoke(string $action, array $payload): ProcessResult
    {
        $spec = json_encode(['action' => $action, ...$payload], JSON_THROW_ON_ERROR);

        $result = $this->runner->run(
            command: ['sudo', '-n', '-u', ProcessRunner::SITE_USER, SudoWrapper::Fs->path()],
            input: $spec,
        );

        if ($result->failed()) {
            throw new RuntimeException("beacon-fs {$action} failed: {$result->errorOutput()}");
        }

        return $result;
    }
}
