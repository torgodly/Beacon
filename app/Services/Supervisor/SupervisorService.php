<?php

namespace App\Services\Supervisor;

use App\Contracts\OutputStream;
use App\Models\Site;
use App\Models\SupervisorProcess;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use Illuminate\Support\Str;
use RuntimeException;

class SupervisorService
{
    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly SupervisorTemplateRenderer $templates,
        private readonly SupervisorStatusParser $statusParser,
    ) {}

    public function programName(Site $site, string $name): string
    {
        $prefix = str_replace('.', '-', $site->name);

        return Str::slug("{$prefix}-{$name}", separator: '-');
    }

    public function logPath(Site $site, string $name): string
    {
        return rtrim((string) config('beacon.paths.site_logs'), '/')."/{$site->name}-{$name}.log";
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createQueueWorker(Site $site, array $data): SupervisorProcess
    {
        $name = (string) $data['name'];
        $programName = $this->programName($site, $name);

        $process = $site->supervisorProcesses()->create([
            'name' => $name,
            'program_name' => $programName,
            'kind' => 'queue_worker',
            'command' => '',
            'directory' => $site->path,
            'run_as' => 'beacon',
            'numprocs' => (int) ($data['numprocs'] ?? 1),
            'autostart' => (bool) ($data['autostart'] ?? true),
            'autorestart' => (bool) ($data['autorestart'] ?? true),
            'stop_wait_secs' => (int) ($data['stop_wait_secs'] ?? 3600),
            'stop_signal' => (string) ($data['stop_signal'] ?? 'TERM'),
            'connection' => (string) ($data['connection'] ?? 'redis'),
            'queue' => (string) ($data['queue'] ?? 'default'),
            'tries' => (int) ($data['tries'] ?? 3),
            'job_timeout' => (int) ($data['job_timeout'] ?? 90),
            'sleep' => (int) ($data['sleep'] ?? 3),
            'max_time' => (int) ($data['max_time'] ?? 3600),
            'config_path' => "/etc/supervisor/conf.d/{$programName}.conf",
            'log_path' => $this->logPath($site, $name),
            'status' => 'stopped',
        ]);

        $this->sync($process);

        $fresh = $process->fresh();

        if ($fresh === null) {
            throw new RuntimeException('Could not reload supervisor process.');
        }

        return $fresh;
    }

    public function sync(SupervisorProcess $process): void
    {
        $process->loadMissing('site');
        $site = $process->site;

        if ($site === null) {
            throw new RuntimeException('Supervisor process is not attached to a site.');
        }

        $config = $this->templates->render($site, $process);

        $write = $this->runner->sudoRoot(
            SudoWrapper::Supervisor,
            ['write', $process->program_name],
            $config,
        );

        if ($write->failed()) {
            throw new RuntimeException($write->errorOutput() ?: 'Could not write supervisor config.');
        }

        $process->update([
            'config_path' => "/etc/supervisor/conf.d/{$process->program_name}.conf",
            'log_path' => $process->log_path ?? $this->logPath($site, $process->name),
        ]);

        $this->refreshStatus($process);
    }

    public function delete(SupervisorProcess $process): void
    {
        $result = $this->runner->sudoRoot(
            SudoWrapper::Supervisor,
            ['delete', $process->program_name],
        );

        if ($result->failed()) {
            throw new RuntimeException($result->errorOutput() ?: 'Could not delete supervisor program.');
        }

        $process->delete();
    }

    public function start(SupervisorProcess $process): void
    {
        $this->control($process, 'start');
    }

    public function stop(SupervisorProcess $process): void
    {
        $this->control($process, 'stop');
    }

    public function restart(SupervisorProcess $process): void
    {
        $this->control($process, 'restart');
    }

    public function restartAllForSite(Site $site, ?OutputStream $stream = null): void
    {
        $processes = $site->supervisorProcesses()->get();

        if ($processes->isEmpty()) {
            $stream?->append("No managed processes to restart.\n");

            return;
        }

        foreach ($processes as $process) {
            $stream?->append("Restarting {$process->program_name}…\n");

            try {
                $this->restart($process);
                $refreshed = $process->fresh();
                $status = $refreshed !== null ? $refreshed->status : 'unknown';
                $stream?->append("  → {$status}\n");
            } catch (RuntimeException $e) {
                $stream?->append("  → failed: {$e->getMessage()}\n");
            }
        }
    }

    public function refreshStatus(SupervisorProcess $process): void
    {
        $result = $this->runner->sudoRoot(
            SudoWrapper::Supervisor,
            ['status', $process->program_name],
        );

        $parsed = $this->statusParser->parseLine($result->output());

        $process->update([
            'status' => $parsed['status'],
            'status_message' => $parsed['message'],
            'last_status_at' => now(),
        ]);
    }

    private function control(SupervisorProcess $process, string $action): void
    {
        $result = $this->runner->sudoRoot(
            SudoWrapper::Supervisor,
            [$action, $process->program_name],
        );

        if ($result->failed()) {
            throw new RuntimeException($result->errorOutput() ?: "Supervisor {$action} failed.");
        }

        $this->refreshStatus($process);
    }
}
