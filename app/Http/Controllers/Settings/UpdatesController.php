<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePanelUpdateRequest;
use App\Models\PanelUpdate;
use App\Models\Server;
use App\Services\Panel\PanelUpdateService;
use App\Support\OutputStream\LogTail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class UpdatesController extends Controller
{
    public function edit(PanelUpdateService $updates): Response
    {
        $server = Server::current();
        $active = PanelUpdate::query()
            ->whereIn('status', ['queued', 'running'])
            ->latest()
            ->first();

        return Inertia::render('settings/updates', [
            'currentVersion' => $server->beacon_version,
            'repo' => config('beacon.panel.repo'),
            'history' => $updates->history(),
            'activeUpdate' => $active ? self::updatePayload($active) : null,
        ]);
    }

    public function store(
        StorePanelUpdateRequest $request,
        PanelUpdateService $updates,
    ): RedirectResponse {
        try {
            $update = $updates->queueDeploy($request->validated('tag'));
        } catch (RuntimeException $e) {
            return back()->withErrors(['tag' => $e->getMessage()]);
        }

        return redirect()
            ->route('updates.edit')
            ->with('toast', ['type' => 'success', 'message' => 'Panel update queued.']);
    }

    public function rollback(PanelUpdateService $updates): RedirectResponse
    {
        try {
            $update = $updates->queueRollback();
        } catch (RuntimeException $e) {
            return back()->withErrors(['update' => $e->getMessage()]);
        }

        return redirect()
            ->route('updates.edit')
            ->with('toast', ['type' => 'success', 'message' => 'Rollback queued.']);
    }

    public function log(PanelUpdate $update, Request $request): JsonResponse
    {
        $offset = max(0, (int) $request->query('offset', 0));
        $tail = LogTail::read($update->log_path, $offset);

        $update->refresh();

        return response()->json([
            'offset' => $tail['offset'],
            'chunk' => $tail['chunk'],
            'eof' => $tail['eof'] && ! in_array($update->status, ['queued', 'running'], true),
            'status' => $update->status,
            'exit_code' => $update->exit_code,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public static function updatePayload(PanelUpdate $update): array
    {
        return [
            'uuid' => $update->uuid,
            'action' => $update->action,
            'tag' => $update->tag,
            'status' => $update->status,
            'exit_code' => $update->exit_code,
            'error' => $update->error,
            'started_at' => $update->started_at?->toIso8601String(),
            'finished_at' => $update->finished_at?->toIso8601String(),
        ];
    }
}
