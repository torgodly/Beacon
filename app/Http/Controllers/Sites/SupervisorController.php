<?php

namespace App\Http\Controllers\Sites;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSupervisorProcessRequest;
use App\Models\Site;
use App\Models\SupervisorProcess;
use App\Services\Supervisor\SupervisorService;
use Illuminate\Http\RedirectResponse;
use RuntimeException;

class SupervisorController extends Controller
{
    public function store(
        StoreSupervisorProcessRequest $request,
        Site $site,
        SupervisorService $supervisor,
    ): RedirectResponse {
        try {
            $validated = $request->validated();
            $kind = $validated['kind'] ?? 'queue_worker';

            if ($kind === 'custom') {
                $supervisor->createCustom($site, $validated);
            } else {
                $supervisor->createQueueWorker($site, $validated);
            }
        } catch (RuntimeException $e) {
            return back()->withErrors(['supervisor' => $e->getMessage()]);
        }

        $site->activity()->log('supervisor.created');

        return back()->with('toast', ['type' => 'success', 'message' => 'Background process created.']);
    }

    public function restart(Site $site, SupervisorProcess $process, SupervisorService $supervisor): RedirectResponse
    {
        abort_unless($process->site_id === $site->id, 404);

        try {
            $supervisor->restart($process);
        } catch (RuntimeException $e) {
            return back()->withErrors(['supervisor' => $e->getMessage()]);
        }

        return back()->with('toast', ['type' => 'success', 'message' => 'Process restarted.']);
    }

    public function destroy(Site $site, SupervisorProcess $process, SupervisorService $supervisor): RedirectResponse
    {
        abort_unless($process->site_id === $site->id, 404);

        try {
            $supervisor->delete($process);
        } catch (RuntimeException $e) {
            return back()->withErrors(['supervisor' => $e->getMessage()]);
        }

        $site->activity()->log('supervisor.deleted');

        return back()->with('toast', ['type' => 'success', 'message' => 'Process removed.']);
    }

    /**
     * @return array<string, mixed>
     */
    public static function processPayload(SupervisorProcess $process): array
    {
        return [
            'id' => $process->id,
            'name' => $process->name,
            'program_name' => $process->program_name,
            'kind' => $process->kind,
            'connection' => $process->connection,
            'queue' => $process->queue,
            'numprocs' => $process->numprocs,
            'status' => $process->status,
            'status_message' => $process->status_message,
            'log_path' => $process->log_path,
            'is_system' => $process->is_system,
            'last_status_at' => $process->last_status_at?->toIso8601String(),
        ];
    }
}
