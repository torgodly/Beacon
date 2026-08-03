<?php

namespace App\Http\Controllers\Webhooks;

use App\Http\Controllers\Controller;
use App\Models\GithubInstallation;
use App\Models\Site;
use App\Models\WebhookDelivery;
use App\Services\Deployment\DeploymentService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class GitHubWebhookController extends Controller
{
    public function __invoke(Request $request): Response
    {
        /** @var GithubInstallation $installation */
        $installation = $request->attributes->get('github_installation');

        $event = (string) $request->header('X-GitHub-Event', 'unknown');
        $deliveryId = (string) $request->header('X-GitHub-Delivery', '');
        /** @var array<string, mixed> $payload */
        $payload = $request->json()->all();

        WebhookDelivery::query()->create([
            'github_installation_id' => $installation->id,
            'delivery_id' => $deliveryId !== '' ? $deliveryId : uniqid('delivery_', true),
            'event' => $event,
            'repository' => isset($payload['repository']['full_name'])
                ? (string) $payload['repository']['full_name']
                : null,
            'status_code' => 202,
            'payload_digest' => hash('sha256', $request->getContent()),
        ]);

        $installation->update([
            'webhook_reachable' => true,
            'last_delivery_at' => now(),
            'last_delivery_status' => 202,
        ]);

        if ($event === 'ping') {
            return response('', 202);
        }

        if ($event === 'push') {
            $this->handlePush($installation, $payload);
        }

        return response('', 202);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function handlePush(GithubInstallation $installation, array $payload): void
    {
        $repoId = isset($payload['repository']['id']) ? (int) $payload['repository']['id'] : null;
        $branch = isset($payload['ref']) ? str_replace('refs/heads/', '', (string) $payload['ref']) : null;
        $sha = isset($payload['after']) ? (string) $payload['after'] : null;

        if ($repoId === null || $branch === null || blank($sha)) {
            return;
        }

        Site::query()
            ->where('github_installation_id', $installation->id)
            ->where('github_repo_id', $repoId)
            ->where('auto_deploy', true)
            ->where('deploy_trigger', 'webhook')
            ->where('repository_branch', $branch)
            ->each(function (Site $site) use ($sha): void {
                try {
                    DeploymentService::queue($site, trigger: 'webhook', commitSha: $sha);
                } catch (\Throwable $e) {
                    Log::warning('GitHub webhook deploy queue failed', [
                        'site' => $site->name,
                        'message' => $e->getMessage(),
                    ]);
                }
            });
    }
}
