<?php

namespace App\Services\Operations;

use App\Contracts\OutputStream;
use App\Models\Operation;
use App\Support\OutputStream\FileOutputStream;
use Illuminate\Database\Eloquent\Model;
use Throwable;

/**
 * Wraps any long-running action in a live, resumable log.
 *
 * Every privileged action in Beacon runs a subprocess that can take anywhere
 * from a second (systemctl restart) to ten minutes (apt install php8.4).
 * Previously most of them surfaced only a status word, so the operator had no
 * idea whether apt was downloading, waiting on a lock, or already dead.
 *
 * Usage:
 *
 *     $runner->run(
 *         type: 'php.install',
 *         title: "Install PHP {$version}",
 *         subject: $phpVersion,
 *         work: function (OutputStream $log) use ($version) {
 *             $log->line("Installing PHP {$version} via apt…");
 *             // … stream a ProcessRunner call into $log …
 *         },
 *     );
 */
class OperationRunner
{
    /**
     * @template TReturn
     *
     * @param  callable(OperationLog): TReturn  $work
     * @return TReturn
     */
    public function run(
        string $type,
        string $title,
        callable $work,
        ?Model $subject = null,
        ?string $summary = null,
        ?int $userId = null,
    ): mixed {
        $operation = $this->start($type, $title, $subject, $summary, $userId);
        $log = new OperationLog(new FileOutputStream($operation->log_path));

        try {
            $result = $work($log);
            $this->succeed($operation, $log);

            return $result;
        } catch (Throwable $e) {
            $this->fail($operation, $log, $e);

            throw $e;
        }
    }

    public function start(
        string $type,
        string $title,
        ?Model $subject = null,
        ?string $summary = null,
        ?int $userId = null,
    ): Operation {
        $operation = new Operation([
            'type' => $type,
            'title' => $title,
            'summary' => $summary,
            'user_id' => $userId ?? auth()->id(),
            'status' => 'running',
            'log_path' => '', // replaced below, once the uuid exists
            'started_at' => now(),
        ]);

        if ($subject !== null) {
            $operation->subject()->associate($subject);
        }

        $operation->save();

        $operation->update(['log_path' => self::logPath($operation->uuid)]);

        return $operation->refresh();
    }

    public function succeed(Operation $operation, ?OperationLog $log = null): void
    {
        $log?->success('Done.');
        $this->finish($operation, 'success', 0);
    }

    public function fail(Operation $operation, ?OperationLog $log, Throwable $e): void
    {
        $log?->error($e->getMessage());

        $this->finish($operation, 'failed', $e->getCode() ?: 1, $e->getMessage());
    }

    public function finish(
        Operation $operation,
        string $status,
        int $exitCode = 0,
        ?string $error = null,
    ): void {
        $finishedAt = now();
        $startedAt = $operation->started_at ?? $finishedAt;

        $operation->update([
            'status' => $status,
            'exit_code' => $exitCode,
            'error' => $error,
            'finished_at' => $finishedAt,
            'duration_ms' => (int) $startedAt->diffInMilliseconds($finishedAt),
        ]);
    }

    public static function logPath(string $uuid): string
    {
        return rtrim((string) config('beacon.paths.operation_logs'), '/')."/{$uuid}.log";
    }
}
