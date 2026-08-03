<?php

namespace App\Services\System;

use Symfony\Component\Process\Process;

/**
 * Immutable outcome of a {@see ProcessRunner} invocation.
 */
final readonly class ProcessResult
{
    public function __construct(
        private ?int $exitCode,
        private string $output,
        private string $errorOutput,
        private bool $timedOut,
        private int $durationMs,
    ) {}

    public static function from(Process $process, int $durationMs): self
    {
        return new self(
            exitCode: $process->getExitCode(),
            output: $process->getOutput(),
            errorOutput: $process->getErrorOutput(),
            timedOut: false,
            durationMs: $durationMs,
        );
    }

    public static function timedOut(Process $process, int $durationMs): self
    {
        return new self(
            exitCode: $process->getExitCode(),
            output: $process->getOutput(),
            errorOutput: $process->getErrorOutput(),
            timedOut: true,
            durationMs: $durationMs,
        );
    }

    public function exitCode(): ?int
    {
        return $this->exitCode;
    }

    public function output(): string
    {
        return $this->output;
    }

    public function errorOutput(): string
    {
        return $this->errorOutput;
    }

    public function combinedOutput(): string
    {
        return $this->output.$this->errorOutput;
    }

    public function successful(): bool
    {
        return ! $this->timedOut && $this->exitCode === 0;
    }

    public function failed(): bool
    {
        return ! $this->successful();
    }

    public function hasTimedOut(): bool
    {
        return $this->timedOut;
    }

    public function durationMs(): int
    {
        return $this->durationMs;
    }
}
