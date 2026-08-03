<?php

namespace App\Jobs;

use App\Models\Server;
use App\Services\Server\ServerMetricsService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class PollServerMetrics implements ShouldQueue
{
    use Queueable;

    public function handle(ServerMetricsService $metrics): void
    {
        $server = Server::current();

        $metrics->record($server);
        $metrics->prune($server);
    }
}
