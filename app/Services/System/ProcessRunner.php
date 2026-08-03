<?php

namespace App\Services\System;

use App\Contracts\OutputStream;
use Symfony\Component\Process\Exception\ProcessTimedOutException;

/**
 * The single choke point through which Beacon executes external commands.
 *
 * Three exits from the panel:
 *
 * - {@see self::run()}     — as the panel itself (`beacon-panel`).
 * - {@see self::sudoRoot()} — as root, via one of the fixed {@see SudoWrapper} scripts.
 * - {@see self::asSite()}   — as the unprivileged site user (`beacon`), via `beacon-run`.
 *
 * Every root-wrapper and `beacon-run`/`beacon-fs` call sends its payload on
 * stdin, never argv — no arg-injection, no `ARG_MAX` limit, no secrets in `ps`.
 */
class ProcessRunner
{
    public const string SITE_USER = 'beacon';

    public const string PANEL_USER = 'beacon-panel';

    public function __construct(private readonly ProcessFactory $processFactory) {}

    /**
     * Run a command as the panel itself.
     *
     * @param  list<string>  $command
     * @param  array<string, string>  $env
     */
    public function run(
        array $command,
        ?string $cwd = null,
        array $env = [],
        int $timeout = 60,
        ?string $input = null,
        ?OutputStream $stream = null,
    ): ProcessResult {
        $process = $this->processFactory->make($command, $cwd, $env + $this->baseEnv(), $input, $timeout);
        $startedAt = hrtime(true);

        try {
            $process->run($stream ? fn (string $type, string $chunk) => $stream->append($chunk) : null);
        } catch (ProcessTimedOutException) {
            return ProcessResult::timedOut($process, $this->elapsedMs($startedAt));
        }

        return ProcessResult::from($process, $this->elapsedMs($startedAt));
    }

    /**
     * Invoke a ROOT wrapper. Config content travels on STDIN — never in argv.
     *
     * @param  list<string>  $args
     */
    public function sudoRoot(SudoWrapper $wrapper, array $args, ?string $stdin = null, int $timeout = 300, ?OutputStream $stream = null): ProcessResult
    {
        return $this->run(['sudo', '-n', $wrapper->path(), ...$args], timeout: $timeout, input: $stdin, stream: $stream);
    }

    /**
     * Execute AS THE SITE USER. The runas target is `beacon` (unprivileged),
     * the wrapper takes zero arguments, and the whole job spec goes over
     * stdin — so there is no argv surface and no sudo env plumbing.
     *
     * @param  list<string>  $argv
     * @param  array<string, string>  $env
     */
    public function asSite(
        array $argv,
        string $cwd,
        array $env = [],
        int $timeout = 120,
        ?OutputStream $stream = null,
        bool $oomExpendable = false,
    ): ProcessResult {
        return $this->run(
            command: ['sudo', '-n', '-u', self::SITE_USER, SudoWrapper::Run->path()],
            timeout: $timeout,
            input: json_encode(
                compact('cwd', 'argv', 'env') + ['oom_expendable' => $oomExpendable],
                JSON_THROW_ON_ERROR,
            ),
            stream: $stream,
        );
    }

    /**
     * @return array<string, string>
     */
    private function baseEnv(): array
    {
        return [
            'HOME' => '/home/'.self::PANEL_USER,
            'USER' => self::PANEL_USER,
            'PATH' => '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        ];
    }

    private function elapsedMs(int|float $startedAt): int
    {
        return (int) ((hrtime(true) - $startedAt) / 1_000_000);
    }
}
