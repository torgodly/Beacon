<?php

namespace App\Jobs;

use App\Models\SiteCommand;
use App\Services\Sites\SiteCommandService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RunSiteCommand implements ShouldQueue
{
    use Queueable;

    public int $timeout = 200;

    public function __construct(public SiteCommand $command) {}

    public function handle(SiteCommandService $commands): void
    {
        $this->command->refresh();

        if (! in_array($this->command->status, ['queued', 'running'], true)) {
            return;
        }

        $commands->run($this->command);
    }
}
