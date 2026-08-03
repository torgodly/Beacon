<?php

namespace Tests\Support;

use App\Services\System\ProcessFactory;
use App\Services\System\ProcessRunner;
use Symfony\Component\Process\Process;

/**
 * Test double for {@see ProcessFactory}.
 *
 * Records every requested command/cwd/env/input so tests can assert the
 * exact argv and stdin a {@see ProcessRunner} call
 * produced, then substitutes a harmless local PHP invocation so the real
 * `Process` machinery (timing, exit codes, timeouts) still runs for real —
 * without ever touching `sudo` or a real Beacon wrapper binary.
 */
class FakeProcessFactory implements ProcessFactory
{
    /**
     * @var list<array{command: list<string>, cwd: ?string, env: array<string, string>, input: ?string, timeout: int}>
     */
    public array $calls = [];

    private int $exitCode = 0;

    private string $output = '';

    private string $errorOutput = '';

    private ?float $sleepSeconds = null;

    public function willReturn(int $exitCode, string $output = '', string $errorOutput = ''): static
    {
        $this->exitCode = $exitCode;
        $this->output = $output;
        $this->errorOutput = $errorOutput;

        return $this;
    }

    public function willSleep(float $seconds): static
    {
        $this->sleepSeconds = $seconds;

        return $this;
    }

    public function make(array $command, ?string $cwd, array $env, ?string $input, int $timeout): Process
    {
        $this->calls[] = compact('command', 'cwd', 'env', 'input', 'timeout');

        $script = $this->sleepSeconds !== null
            ? sprintf('usleep(%d);', (int) ($this->sleepSeconds * 1_000_000))
            : '';

        $script .= sprintf(
            'fwrite(STDOUT, %s); fwrite(STDERR, %s); exit(%d);',
            var_export($this->output, true),
            var_export($this->errorOutput, true),
            $this->exitCode,
        );

        $process = new Process([PHP_BINARY, '-r', $script], $cwd, null, null, $timeout);
        $process->setIdleTimeout(null);

        return $process;
    }

    public function lastCall(): array
    {
        return $this->calls[array_key_last($this->calls)];
    }
}
