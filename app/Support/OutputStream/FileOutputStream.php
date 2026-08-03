<?php

namespace App\Support\OutputStream;

use App\Contracts\OutputStream;
use App\Services\System\ProcessRunner;
use RuntimeException;

/**
 * Appends process output to a log file on disk as it is produced.
 *
 * The panel owns this file handle end to end — it is the process that spawned
 * the child (via {@see ProcessRunner}) and it is the
 * process writing the log, so the 1s UI polling loop never needs cross-user
 * file access. The log survives page reloads and process crashes.
 */
class FileOutputStream implements OutputStream
{
    /** @var resource */
    private $handle;

    public function __construct(private readonly string $path)
    {
        $directory = dirname($path);

        if (! is_dir($directory) && ! mkdir($directory, 0750, true) && ! is_dir($directory)) {
            throw new RuntimeException("Unable to create log directory [{$directory}].");
        }

        $handle = fopen($path, 'ab');

        if ($handle === false) {
            throw new RuntimeException("Unable to open log file [{$path}] for writing.");
        }

        $this->handle = $handle;
    }

    public function append(string $chunk): void
    {
        fwrite($this->handle, $chunk);
    }

    public function close(): void
    {
        if (is_resource($this->handle)) {
            fclose($this->handle);
        }
    }

    public function path(): string
    {
        return $this->path;
    }

    public function __destruct()
    {
        $this->close();
    }
}
