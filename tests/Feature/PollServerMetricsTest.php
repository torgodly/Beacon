<?php

namespace Tests\Feature;

use App\Jobs\PollServerMetrics;
use App\Models\Server;
use App\Models\ServerMetric;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PollServerMetricsTest extends TestCase
{
    use RefreshDatabase;

    public function test_job_records_metrics_and_prunes_old_rows(): void
    {
        Server::factory()->create(['id' => 1]);

        ServerMetric::query()->create([
            'server_id' => 1,
            'cpu_percent' => 1,
            'memory_used_mb' => 1,
            'memory_total_mb' => 1,
            'swap_used_mb' => 0,
            'disk_used_mb' => 1,
            'disk_total_mb' => 1,
            'load_1' => 0,
            'load_5' => 0,
            'load_15' => 0,
            'uptime_seconds' => 1,
            'recorded_at' => now()->subDays(3),
        ]);

        PollServerMetrics::dispatchSync();

        $this->assertSame(1, ServerMetric::query()->count());
        $this->assertTrue(ServerMetric::query()->first()?->recorded_at?->isToday() ?? false);
    }
}
