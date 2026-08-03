<?php

namespace App\Jobs;

use App\Models\PanelUpdate;
use App\Services\Panel\PanelUpdateService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RunPanelUpdate implements ShouldQueue
{
    use Queueable;

    public int $timeout = 3700;

    public function __construct(public PanelUpdate $update) {}

    public function handle(PanelUpdateService $updates): void
    {
        $updates->run($this->update);
    }
}
