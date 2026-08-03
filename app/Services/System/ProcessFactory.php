<?php

namespace App\Services\System;

use Symfony\Component\Process\Process;

/**
 * Builds the {@see Process} instance a {@see ProcessRunner} call will execute.
 *
 * Injecting this (rather than calling `new Process(...)` directly inside
 * {@see ProcessRunner}) is what lets tests fake process execution entirely —
 * no real `sudo`, no real Beacon wrapper binaries, no touching the host.
 */
interface ProcessFactory
{
    /**
     * @param  list<string>  $command
     * @param  array<string, string>  $env
     */
    public function make(array $command, ?string $cwd, array $env, ?string $input, int $timeout): Process;
}
