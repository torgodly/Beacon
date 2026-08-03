<?php

namespace App\Services\Cron;

use App\Models\CronJob;
use App\Models\Server;
use App\Models\Site;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use Illuminate\Support\Collection;
use RuntimeException;

class CronService
{
    private const string START_MARKER = '# >>> BEACON MANAGED BLOCK';

    private const string END_MARKER = '# <<< END BEACON MANAGED BLOCK >>>';

    public function __construct(private readonly ProcessRunner $runner) {}

    public function sync(Server $server): void
    {
        $existing = $this->read();
        $unmanaged = trim($this->stripManagedBlock($existing));
        $jobs = CronJob::query()
            ->where('server_id', $server->id)
            ->where('enabled', true)
            ->orderBy('id')
            ->get();

        $block = $this->buildManagedBlock($jobs);
        $content = $unmanaged === '' ? $block : "{$unmanaged}\n\n{$block}";

        $this->write($content);
    }

    public function ensureLaravelScheduler(Site $site, bool $enabled): CronJob
    {
        $server = Server::current();
        $php = $site->php_version ?? config('beacon.sites.default_php_version', '8.4');
        $command = "cd {$site->path} && /usr/bin/php{$php} artisan schedule:run";

        $job = CronJob::query()->updateOrCreate(
            [
                'site_id' => $site->id,
                'is_laravel_scheduler' => true,
            ],
            [
                'server_id' => $server->id,
                'name' => 'Laravel scheduler',
                'command' => $command,
                'run_as' => 'beacon',
                'expression' => '* * * * *',
                'frequency_preset' => 'every_minute',
                'output_redirect' => '>> /dev/null 2>&1',
                'enabled' => $enabled,
            ],
        );

        $this->sync($server);

        return $job;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createJob(Site $site, array $data): CronJob
    {
        $server = Server::current();

        $job = CronJob::query()->create([
            'server_id' => $server->id,
            'site_id' => $site->id,
            'name' => (string) $data['name'],
            'command' => (string) $data['command'],
            'run_as' => 'beacon',
            'expression' => (string) $data['expression'],
            'frequency_preset' => $data['frequency_preset'] ?? null,
            'is_laravel_scheduler' => false,
            'output_redirect' => $data['output_redirect'] ?? '>> /dev/null 2>&1',
            'enabled' => (bool) ($data['enabled'] ?? true),
        ]);

        $this->sync($server);

        return $job;
    }

    public function deleteJob(CronJob $job): void
    {
        $serverId = $job->server_id;
        $job->delete();
        $this->sync(Server::query()->findOrFail($serverId));
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateJob(CronJob $job, array $data): CronJob
    {
        $job->update($data);
        $this->sync(Server::query()->findOrFail($job->server_id));

        return $job->fresh();
    }

    /**
     * @param  Collection<int, CronJob>  $jobs
     */
    private function buildManagedBlock(Collection $jobs): string
    {
        $lines = [
            self::START_MARKER.' — generated '.now()->toIso8601String().'. Do not edit between markers. <<<',
            'SHELL=/bin/bash',
            'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        ];

        foreach ($jobs as $job) {
            $redirect = $job->output_redirect ?? '>> /dev/null 2>&1';
            $lines[] = trim("{$job->expression} {$job->command} {$redirect}");
        }

        $lines[] = self::END_MARKER;

        return implode("\n", $lines)."\n";
    }

    private function read(): string
    {
        $result = $this->runner->sudoRoot(SudoWrapper::Cron, ['read']);

        if ($result->failed()) {
            throw new RuntimeException($result->errorOutput() ?: 'Could not read crontab.');
        }

        return $result->output();
    }

    private function write(string $contents): void
    {
        $result = $this->runner->sudoRoot(SudoWrapper::Cron, ['write'], $contents);

        if ($result->failed()) {
            throw new RuntimeException($result->errorOutput() ?: 'Could not write crontab.');
        }
    }

    private function stripManagedBlock(string $contents): string
    {
        $pattern = '/'.preg_quote(self::START_MARKER, '/').'.*?'.preg_quote(self::END_MARKER, '/').'\s*/s';

        return trim((string) preg_replace($pattern, '', $contents));
    }
}
