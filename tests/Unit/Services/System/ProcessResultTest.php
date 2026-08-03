<?php

namespace Tests\Unit\Services\System;

use App\Services\System\ProcessResult;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class ProcessResultTest extends TestCase
{
    public function test_from_wraps_a_successful_process(): void
    {
        $process = new Process([PHP_BINARY, '-r', 'fwrite(STDOUT, "hello"); fwrite(STDERR, "warn"); exit(0);']);
        $process->run();

        $result = ProcessResult::from($process, 42);

        $this->assertSame(0, $result->exitCode());
        $this->assertSame('hello', $result->output());
        $this->assertSame('warn', $result->errorOutput());
        $this->assertSame('hellowarn', $result->combinedOutput());
        $this->assertTrue($result->successful());
        $this->assertFalse($result->failed());
        $this->assertFalse($result->hasTimedOut());
        $this->assertSame(42, $result->durationMs());
    }

    public function test_from_wraps_a_failed_process(): void
    {
        $process = new Process([PHP_BINARY, '-r', 'exit(1);']);
        $process->run();

        $result = ProcessResult::from($process, 10);

        $this->assertSame(1, $result->exitCode());
        $this->assertFalse($result->successful());
        $this->assertTrue($result->failed());
    }

    public function test_timed_out_factory_marks_the_result_as_failed(): void
    {
        $process = new Process([PHP_BINARY, '-r', 'exit(0);']);
        $process->run();

        $result = ProcessResult::timedOut($process, 5);

        $this->assertTrue($result->hasTimedOut());
        $this->assertTrue($result->failed());
        $this->assertFalse($result->successful());
    }
}
