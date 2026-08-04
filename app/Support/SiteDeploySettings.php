<?php

namespace App\Support;

use App\Models\Server;
use App\Models\Site;
use App\Services\Github\WebhookReachability;

class SiteDeploySettings
{
    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function normalize(array $data, ?Site $site = null): array
    {
        if (blank($data['repository'] ?? null)) {
            $data['auto_deploy'] = false;
            $data['deploy_trigger'] = 'manual';

            return $data;
        }

        $autoDeploy = (bool) ($data['auto_deploy'] ?? false);

        if (! $autoDeploy) {
            $data['auto_deploy'] = false;
            $data['deploy_trigger'] = 'manual';

            return $data;
        }

        $githubInstallationId = $data['github_installation_id'] ?? $site?->github_installation_id;

        $data['auto_deploy'] = true;
        $data['deploy_trigger'] = filled($githubInstallationId)
            && app(WebhookReachability::class)->canReceiveWebhooks(Server::current())
            ? 'webhook'
            : 'poll';

        return $data;
    }
}
