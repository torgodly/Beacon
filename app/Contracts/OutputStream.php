<?php

namespace App\Contracts;

use App\Support\OutputStream\FileOutputStream;

/**
 * A live sink for a running process's output.
 *
 * Deployments and Web Console commands stream through an implementation of
 * this contract while they run. Today that is {@see FileOutputStream},
 * polled by the UI via byte offset. A Reverb-backed decorator can be added
 * later without any change to callers or to the UI's polling fallback.
 */
interface OutputStream
{
    /**
     * Append a chunk of output as it is produced.
     */
    public function append(string $chunk): void;

    /**
     * Release any underlying resource (file handles, sockets, ...).
     */
    public function close(): void;
}
