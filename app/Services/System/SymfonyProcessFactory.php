<?php

namespace App\Services\System;

use Symfony\Component\Process\Process;

/**
 * Default {@see ProcessFactory} — builds a real Symfony {@see Process}.
 */
class SymfonyProcessFactory implements ProcessFactory
{
    public function make(array $command, ?string $cwd, array $env, ?string $input, int $timeout): Process
    {
        $process = new Process($command, $cwd, $env, $input, $timeout);
        $process->setIdleTimeout(null);

        return $process;
    }
}
