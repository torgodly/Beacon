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
        private readonly SsrLauncher $ssrLauncher,
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
            'job_timeout' => (int) ($data['job_timeout'] ?? 60),
            'sleep' => (int) ($data['sleep'] ?? 3),
            'max_time' => (int) ($data['max_time'] ?? 3600),
            'backoff' => isset($data['backoff']) ? (int) $data['backoff'] : null,
            'rest' => isset($data['rest']) ? (int) $data['rest'] : null,
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

    /**
     * @param  array<string, mixed>  $data
     */
    public function createCustom(Site $site, array $data): SupervisorProcess
    {
        $name = (string) $data['name'];
        $programName = $this->programName($site, $name);

        $process = $site->supervisorProcesses()->create([
            'name' => $name,
            'program_name' => $programName,
            'kind' => 'custom',
            'command' => (string) $data['command'],
            'directory' => $site->path,
            'run_as' => 'beacon',
            'numprocs' => (int) ($data['numprocs'] ?? 1),
            'autostart' => (bool) ($data['autostart'] ?? true),
            'autorestart' => (bool) ($data['autorestart'] ?? true),
            'stop_wait_secs' => (int) ($data['stop_wait_secs'] ?? 15),
            'stop_signal' => (string) ($data['stop_signal'] ?? 'TERM'),
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

    /**
     * Create or refresh the Node server that backs a Next.js / Nuxt site.
     *
     * Without this the site has an Nginx reverse proxy pointing at a port with
     * nothing listening on it, so every request 502s. Called on site creation
     * and whenever the runtime (Node version, port, package manager) changes.
     *
     * `$autostart` is null by default, meaning "keep whatever the process
     * already had, and start life disabled". A brand new site has nothing to
     * launch until `npm install` has run, and letting Supervisor retry-loop
     * into FATAL is just noise; the first successful deployment passes true.
     */
    public function syncSsrProcess(Site $site, ?bool $autostart = null): ?SupervisorProcess
    {
        if (! SsrLauncher::supports($site->type)) {
            return null;
        }

        $existing = $site->supervisorProcesses()->where('kind', 'ssr')->first();
        $autostart ??= (bool) ($existing->autostart ?? false);

        $command = $this->ssrLauncher->sync($site);
        $programName = $this->programName($site, 'ssr');

        $process = $site->supervisorProcesses()->updateOrCreate(
            ['kind' => 'ssr'],
            [
                'name' => 'ssr',
                'program_name' => $programName,
                'command' => $command,
                'directory' => $site->path,
                'run_as' => 'beacon',
                'numprocs' => 1,
                'autostart' => $autostart,
                'autorestart' => $autostart,
                'stop_wait_secs' => 20,
                'stop_signal' => 'TERM',
                'config_path' => "/etc/supervisor/conf.d/{$programName}.conf",
                'log_path' => $this->logPath($site, 'ssr'),
                'is_system' => true,
            ],
        );

        $this->sync($process);

        return $process->fresh();
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

    public function deleteAllForSite(Site $site): void
    {
        foreach ($site->supervisorProcesses as $process) {
            $this->delete($process);
        }
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
        $this->control($process, 'restart', fallbackToStart: true);
    }

    public function ensureRunning(SupervisorProcess $process): void
    {
        $this->refreshStatus($process);
        $process->refresh();

        if (in_array($process->status, ['running', 'starting'], true)) {
            return;
        }

        $this->start($process);
        $process->refresh();

        if (! in_array($process->status, ['running', 'starting'], true)) {
            $detail = trim((string) $process->status_message);

            throw new RuntimeException(
                $detail !== '' ? $detail : 'Process is not running.',
            );
        }
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

    private function control(SupervisorProcess $process, string $action, bool $fallbackToStart = false): void
    {
        $result = $this->runner->sudoRoot(
            SudoWrapper::Supervisor,
            [$action, $process->program_name],
        );

        if ($result->failed() && $fallbackToStart && $action === 'restart') {
            $result = $this->runner->sudoRoot(
                SudoWrapper::Supervisor,
                ['start', $process->program_name],
            );
        }

        if ($result->failed()) {
            throw new RuntimeException($result->errorOutput() ?: "Supervisor {$action} failed.");
        }

        $this->refreshStatus($process);
    }
}
