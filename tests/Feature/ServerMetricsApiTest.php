<?php

namespace Tests\Feature;

use App\Models\Server;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ServerMetricsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_metrics_endpoint_requires_authentication(): void
    {
        $this->getJson(route('api.server.metrics'))->assertUnauthorized();
    }

    public function test_metrics_endpoint_returns_current_metrics(): void
    {
        Server::factory()->create(['id' => 1]);
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson(route('api.server.metrics'));

        $response->assertOk();
        $response->assertJsonStructure([
            'server' => ['hostname', 'beacon_version'],
            'metrics' => [
                'cpu_percent',
                'memory_used_mb',
                'memory_total_mb',
                'disk_used_mb',
                'disk_total_mb',
                'uptime_seconds',
            ],
            'recorded_at',
        ]);
    }
}
