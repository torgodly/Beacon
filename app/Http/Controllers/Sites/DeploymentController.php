<?php

namespace App\Http\Controllers\Sites;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateDeployScriptRequest;
use App\Models\Deployment;
use App\Models\Site;
use App\Services\Deployment\DeploymentService;
use App\Services\System\SiteFilesystem;
use App\Support\OutputStream\LogTail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class DeploymentController extends Controller
{
    public function store(Request $request, Site $site): RedirectResponse
    {
        $deployment = DeploymentService::queue(
            site: $site,
            trigger: 'manual',
            user: $request->user(),
        );

        return redirect()
            ->to(route('sites.show', $site->name).'?'.http_build_query([
                'tab' => 'deployments',
                'deployment' => $deployment->uuid,
            ]))
            ->with('toast', ['type' => 'success', 'message' => 'Deployment queued.']);
    }

    public function log(Site $site, Deployment $deployment, Request $request): JsonResponse
    {
        abort_unless($deployment->site_id === $site->id, 404);

        $offset = max(0, (int) $request->query('offset', 0));
        $tail = LogTail::read($deployment->log_path, $offset);

        $deployment->refresh();

        return response()->json([
            'offset' => $tail['offset'],
            'chunk' => $tail['chunk'],
            'eof' => $tail['eof'] && ! in_array($deployment->status, ['queued', 'running'], true),
            'status' => $deployment->status,
            'duration_ms' => $deployment->duration_ms,
            'exit_code' => $deployment->exit_code,
        ]);
    }

    public function updateScript(
        UpdateDeployScriptRequest $request,
        Site $site,
        SiteFilesystem $filesystem,
    ): RedirectResponse {
        $script = $request->validated('deploy_script');
        $site->update(['deploy_script' => $script]);
        $filesystem->write($site->deployScriptPath(), $script, 0700);
        $site->activity()->log('deployment.script_updated');

        return back()->with('toast', ['type' => 'success', 'message' => 'Deploy script saved.']);
    }

    /**
     * @return array<string, mixed>
     */
    public static function deploymentPayload(Deployment $deployment): array
    {
        return [
            'uuid' => $deployment->uuid,
            'status' => $deployment->status,
            'trigger' => $deployment->trigger,
            'branch' => $deployment->branch,
            'commit_sha' => $deployment->commit_sha,
            'commit_message' => $deployment->commit_message,
            'commit_author' => $deployment->commit_author,
            'duration_ms' => $deployment->duration_ms,
            'exit_code' => $deployment->exit_code,
            'failed_step' => $deployment->failed_step,
            'started_at' => $deployment->started_at?->toIso8601String(),
            'finished_at' => $deployment->finished_at?->toIso8601String(),
            'created_at' => $deployment->created_at?->toIso8601String(),
        ];
    }
}
