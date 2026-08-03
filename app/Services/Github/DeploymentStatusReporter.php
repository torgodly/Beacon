<?php

namespace App\Services\Github;

use App\Models\Deployment;
use App\Models\Site;

class DeploymentStatusReporter
{
    public function __construct(private readonly GitHubAppClient $client) {}

    public function inProgress(Deployment $deployment): void
    {
        $this->report($deployment, 'pending');
    }

    public function success(Deployment $deployment): void
    {
        $this->report($deployment, 'success');
    }

    public function failure(Deployment $deployment): void
    {
        $this->report($deployment, 'failure');
    }

    private function report(Deployment $deployment, string $state): void
    {
        $site = $deployment->site;

        if ($site === null || ! $this->canReport($site)) {
            return;
        }

        $installation = $site->githubInstallation;

        if ($installation === null) {
            return;
        }

        [$owner, $repo] = explode('/', (string) $site->repository, 2) + [null, null];

        if ($owner === null || $repo === null || blank($deployment->commit_sha)) {
            return;
        }

        $this->client->createCommitStatus(
            $installation,
            $owner,
            $repo,
            (string) $deployment->commit_sha,
            [
                'state' => $state,
                'target_url' => route('sites.show', [
                    'site' => $site->name,
                    'tab' => 'deployments',
                    'deployment' => $deployment->uuid,
                ]),
                'description' => match ($state) {
                    'success' => 'Deployment succeeded',
                    'failure' => 'Deployment failed',
                    default => 'Deployment running',
                },
                'context' => 'beacon/deployment',
            ],
        );
    }

    private function canReport(Site $site): bool
    {
        return $site->repository_provider === 'github'
            && filled($site->repository)
            && $site->github_installation_id !== null
            && str_contains((string) $site->repository, '/');
    }
}
