<?php

namespace App\Jobs;

use App\Models\Site;
use App\Services\Deployment\DeploymentService;
use App\Services\Deployment\GitService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class PollRepositoryHeads implements ShouldQueue
{
    use Queueable;

    public function handle(GitService $git): void
    {
        Site::query()
            ->where('auto_deploy', true)
            ->where('deploy_trigger', 'poll')
            ->whereNotNull('repository')
            ->each(function (Site $site) use ($git): void {
                $interval = $site->effectivePollIntervalSeconds();

                if ($site->last_polled_at !== null
                    && $site->last_polled_at->addSeconds($interval)->isFuture()) {
                    return;
                }

                $sha = $git->remoteHead($site);

                if ($sha === null) {
                    return;
                }

                $previous = $site->last_polled_sha;

                $site->update([
                    'last_polled_sha' => $sha,
                    'last_polled_at' => now(),
                ]);

                if ($previous !== null && $previous !== $sha) {
                    DeploymentService::queue($site, trigger: 'poll', commitSha: $sha);
                }
            });
    }
}
