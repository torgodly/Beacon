<?php

namespace App\Jobs;

use App\Models\Deployment;
use App\Services\Deployment\DeploymentService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RunDeployment implements ShouldQueue
{
    use Queueable;

    public int $timeout = 2000;

    public function __construct(public Deployment $deployment) {}

    public function handle(DeploymentService $deployments): void
    {
        $this->deployment->refresh();

        if (! in_array($this->deployment->status, ['queued', 'running'], true)) {
            return;
        }

        $deployments->run($this->deployment);
    }
}
