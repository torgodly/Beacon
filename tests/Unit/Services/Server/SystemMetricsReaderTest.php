<?php

namespace Tests\Unit\Services\Server;

use App\Services\Server\SystemMetricsReader;
use Tests\TestCase;

class SystemMetricsReaderTest extends TestCase
{
    public function test_collect_returns_expected_metric_keys(): void
    {
        $reader = new SystemMetricsReader;
        $metrics = $reader->collect();

        $this->assertArrayHasKey('cpu_percent', $metrics);
        $this->assertArrayHasKey('memory_used_mb', $metrics);
        $this->assertArrayHasKey('memory_total_mb', $metrics);
        $this->assertArrayHasKey('swap_used_mb', $metrics);
        $this->assertArrayHasKey('disk_used_mb', $metrics);
        $this->assertArrayHasKey('disk_total_mb', $metrics);
        $this->assertArrayHasKey('load_1', $metrics);
        $this->assertArrayHasKey('uptime_seconds', $metrics);
        $this->assertGreaterThanOrEqual(0, $metrics['disk_total_mb']);
    }
}
