<?php

namespace App\Http\Controllers\Sites;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSiteCommandRequest;
use App\Models\Site;
use App\Models\SiteCommand;
use App\Services\Sites\SiteCommandService;
use App\Support\OutputStream\LogTail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ConsoleController extends Controller
{
    public function store(
        StoreSiteCommandRequest $request,
        Site $site,
    ): RedirectResponse {
        $command = SiteCommandService::queue(
            site: $site,
            user: $request->user(),
            command: $request->validated('command'),
        );

        return redirect()
            ->to(route('sites.show', $site->name).'?'.http_build_query([
                'tab' => 'console',
                'command' => $command->uuid,
            ]))
            ->with('toast', ['type' => 'success', 'message' => 'Command queued.']);
    }

    public function log(Site $site, SiteCommand $command, Request $request): JsonResponse
    {
        abort_unless($command->site_id === $site->id, 404);

        $offset = max(0, (int) $request->query('offset', 0));
        $tail = LogTail::read($command->log_path, $offset);

        $command->refresh();

        return response()->json([
            'offset' => $tail['offset'],
            'chunk' => $tail['chunk'],
            'eof' => $tail['eof'] && ! in_array($command->status, ['queued', 'running'], true),
            'status' => $command->status,
            'duration_ms' => $command->duration_ms,
            'exit_code' => $command->exit_code,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public static function commandPayload(SiteCommand $command): array
    {
        return [
            'uuid' => $command->uuid,
            'command' => $command->command,
            'status' => $command->status,
            'exit_code' => $command->exit_code,
            'duration_ms' => $command->duration_ms,
            'started_at' => $command->started_at?->toIso8601String(),
            'finished_at' => $command->finished_at?->toIso8601String(),
            'created_at' => $command->created_at?->toIso8601String(),
        ];
    }
}
