<?php

namespace App\Services\Operations;

use App\Contracts\OutputStream;

/**
 * A thin, colour-aware writer over an {@see OutputStream}.
 *
 * Operations write for a human staring at a terminal mid-incident, so the
 * helpers below emit the same ANSI vocabulary the deploy pipeline uses and
 * the log viewer already knows how to colour.
 */
class OperationLog implements OutputStream
{
    public function __construct(private readonly OutputStream $stream) {}

    public function append(string $chunk): void
    {
        $this->stream->append($chunk);
    }

    public function close(): void
    {
        $this->stream->close();
    }

    public function line(string $message): void
    {
        $this->append($message."\n");
    }

    /** A section boundary — cyan, matching the deploy pipeline's steps. */
    public function step(string $message): void
    {
        $this->append("\n\033[36m━━ {$message}\033[0m\n");
    }

    public function success(string $message): void
    {
        $this->append("\033[32m✔ {$message}\033[0m\n");
    }

    public function warn(string $message): void
    {
        $this->append("\033[33m! {$message}\033[0m\n");
    }

    public function error(string $message): void
    {
        $this->append("\033[31m✖ {$message}\033[0m\n");
    }

    /** Dim, for command echoes and metadata. */
    public function muted(string $message): void
    {
        $this->append("\033[90m{$message}\033[0m\n");
    }
}
