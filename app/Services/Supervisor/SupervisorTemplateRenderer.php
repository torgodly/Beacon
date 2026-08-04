<?php

namespace App\Services\Supervisor;

use App\Models\Site;
use App\Models\SupervisorProcess;
use Illuminate\Support\Facades\View;
use InvalidArgumentException;

class SupervisorTemplateRenderer
{
    public function render(Site $site, SupervisorProcess $process): string
    {
        $view = match ($process->kind) {
            'queue_worker' => 'supervisor.queue-worker',
            'ssr' => 'supervisor.ssr',
            'custom' => 'supervisor.custom',
            default => throw new InvalidArgumentException("Unknown supervisor kind [{$process->kind}]."),
        };

        return View::make($view, compact('site', 'process'))->render();
    }
}
