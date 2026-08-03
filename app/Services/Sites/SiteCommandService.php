<?php

namespace App\Services\Sites;

use App\Jobs\RunSiteCommand;
use App\Models\Site;
use App\Models\SiteCommand;
use App\Models\User;
use App\Services\Deployment\DeploymentService;
use App\Services\System\ProcessRunner;
use App\Support\OutputStream\FileOutputStream;
use Illuminate\Support\Str;

class SiteCommandService
{
    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly DeploymentService $deployments,
    ) {}

    public static function queue(Site $site, User $user, string $command): SiteCommand
    {
        $logDirectory = rtrim((string) config('beacon.paths.command_logs'), '/');

        $siteCommand = SiteCommand::query()->create([
            'uuid' => (string) Str::uuid(),
            'site_id' => $site->id,
            'user_id' => $user->id,
            'command' => $command,
            'status' => 'queued',
            'log_path' => "{$logDirectory}/{$site->name}-".Str::uuid().'.log',
        ]);

        RunSiteCommand::dispatch($siteCommand);

        return $siteCommand;
    }

    public function run(SiteCommand $command): void
    {
        $site = $command->site;

        if ($site === null) {
            $command->update(['status' => 'failed', 'exit_code' => 1, 'finished_at' => now()]);

            return;
        }

        $timeout = (int) config('beacon.console.timeout', 120);
        $stream = new FileOutputStream($command->log_path);
        $startedAt = now();

        $command->update(['status' => 'running', 'started_at' => $startedAt]);

        $result = $this->runner->asSite(
            argv: [
                '/usr/bin/timeout', '--foreground', '--kill-after=5s', "{$timeout}s",
                '/bin/bash', '-lc', $command->command,
            ],
            cwd: $site->path,
            env: $this->deployments->deployEnvironment($site),
            timeout: $timeout + 10,
            stream: $stream,
        );

        $finishedAt = now();
        $durationMs = (int) $startedAt->diffInMilliseconds($finishedAt);
        $exitCode = $result->exitCode();

        $status = match (true) {
            $exitCode === 124 => 'timed_out',
            $result->successful() => 'success',
            default => 'failed',
        };

        $command->update([
            'status' => $status,
            'exit_code' => $exitCode,
            'duration_ms' => $durationMs,
            'finished_at' => $finishedAt,
            'output' => $this->readOutputTail($command->log_path),
        ]);

        $stream->close();
    }

    private function readOutputTail(string $path): ?string
    {
        if (! is_file($path)) {
            return null;
        }

        $maxBytes = (int) config('beacon.deployments.output_tail_kb', 256) * 1024;
        $size = filesize($path);

        if ($size === false || $size <= $maxBytes) {
            return file_get_contents($path) ?: null;
        }

        $handle = fopen($path, 'rb');

        if ($handle === false) {
            return null;
        }

        fseek($handle, -$maxBytes, SEEK_END);
        $tail = fread($handle, max(1, $maxBytes));
        fclose($handle);

        return $tail === false ? null : $tail;
    }
}
