<?php

namespace App\Services\Panel;

use App\Jobs\RunPanelUpdate;
use App\Models\PanelUpdate;
use App\Models\Server;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use App\Support\OutputStream\FileOutputStream;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use RuntimeException;

class PanelUpdateService
{
    public function __construct(private readonly ProcessRunner $runner) {}

    public function queueDeploy(string $tag): PanelUpdate
    {
        if (! preg_match('/^v\d+\.\d+\.\d+$/', $tag)) {
            throw new RuntimeException('Release tag must look like v1.2.3.');
        }

        if (PanelUpdate::query()->whereIn('status', ['queued', 'running'])->exists()) {
            throw new RuntimeException('A panel update is already in progress.');
        }

        $update = $this->createRecord('deploy', $tag);
        RunPanelUpdate::dispatch($update);

        return $update;
    }

    public function queueRollback(): PanelUpdate
    {
        if (PanelUpdate::query()->whereIn('status', ['queued', 'running'])->exists()) {
            throw new RuntimeException('A panel update is already in progress.');
        }

        $update = $this->createRecord('rollback');
        RunPanelUpdate::dispatch($update);

        return $update;
    }

    public function run(PanelUpdate $update): void
    {
        $update->refresh();

        if (! in_array($update->status, ['queued', 'running'], true)) {
            return;
        }

        $stream = new FileOutputStream($update->log_path);
        $startedAt = now();

        $update->update([
            'status' => 'running',
            'started_at' => $startedAt,
        ]);

        $args = $update->action === 'rollback'
            ? ['rollback']
            : ['deploy', (string) $update->tag];

        $result = $this->runner->sudoRoot(
            SudoWrapper::Update,
            $args,
            timeout: 3600,
            stream: $stream,
        );

        $stream->close();
        $finishedAt = now();

        $status = $result->successful() ? 'success' : 'failed';

        $update->update([
            'status' => $status,
            'exit_code' => $result->exitCode(),
            'error' => $result->failed()
                ? trim($result->combinedOutput()) ?: 'Panel update failed.'
                : null,
            'finished_at' => $finishedAt,
        ]);

        if ($status === 'success' && $update->action === 'deploy' && $update->tag !== null) {
            Server::current()->update([
                'beacon_version' => $update->tag,
            ]);
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function history(int $limit = 10): array
    {
        return array_values(PanelUpdate::query()
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn (PanelUpdate $update): array => [
                'uuid' => $update->uuid,
                'action' => $update->action,
                'tag' => $update->tag,
                'status' => $update->status,
                'exit_code' => $update->exit_code,
                'error' => $update->error,
                'started_at' => $update->started_at?->toIso8601String(),
                'finished_at' => $update->finished_at?->toIso8601String(),
                'created_at' => $update->created_at?->toIso8601String(),
            ])
            ->all());
    }

    private function createRecord(string $action, ?string $tag = null): PanelUpdate
    {
        $logDirectory = rtrim((string) config('beacon.paths.panel_update_logs'), '/');
        File::ensureDirectoryExists($logDirectory);

        $uuid = (string) Str::uuid();

        return PanelUpdate::query()->create([
            'uuid' => $uuid,
            'action' => $action,
            'tag' => $tag,
            'status' => 'queued',
            'log_path' => "{$logDirectory}/{$uuid}.log",
        ]);
    }
}
