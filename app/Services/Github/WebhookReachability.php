<?php

namespace App\Services\Github;

use App\Models\GithubInstallation;
use App\Models\Server;

class WebhookReachability
{
    public function __construct(private readonly GitHubAppClient $client) {}

    public function refresh(GithubInstallation $installation): GithubInstallation
    {
        $url = route('webhooks.github');

        if ($installation->webhook_url !== $url) {
            $this->client->patchAppHookConfig($installation, ['url' => $url]);
            $installation->update(['webhook_url' => $url]);
        }

        $deliveries = $this->client->listAppHookDeliveries($installation);
        $latest = $deliveries[0] ?? null;

        $installation->update([
            'webhook_reachable' => $latest !== null && (int) ($latest['status_code'] ?? 500) < 400,
            'last_delivery_at' => isset($latest['delivered_at']) ? now()->parse($latest['delivered_at']) : null,
            'last_delivery_status' => isset($latest['status_code']) ? (int) $latest['status_code'] : null,
        ]);

        return $installation->fresh();
    }

    public function canReceiveWebhooks(Server $server): bool
    {
        return filled($server->panel_domain)
            && $server->panel_url_public
            && ! filter_var($server->panel_domain, FILTER_VALIDATE_IP);
    }

    public function recommendedTrigger(Server $server): string
    {
        return $this->canReceiveWebhooks($server) ? 'webhook' : 'poll';
    }
}
