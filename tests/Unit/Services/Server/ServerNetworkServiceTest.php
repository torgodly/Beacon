<?php

namespace Tests\Unit\Services\Server;

use App\Models\Server;
use App\Services\Server\ServerNetworkService;
use App\Services\System\ProcessResult;
use App\Services\System\ProcessRunner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class ServerNetworkServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_sync_public_ip_replaces_loopback_with_detected_address(): void
    {
        $this->mock(ProcessRunner::class, function (MockInterface $mock): void {
            $mock->shouldReceive('run')
                ->once()
                ->andReturn(new ProcessResult(
                    exitCode: 0,
                    output: "192.168.1.50\n",
                    errorOutput: '',
                    timedOut: false,
                    durationMs: 1,
                ));
        });

        $server = Server::factory()->create([
            'id' => 1,
            'public_ip' => '127.0.0.1',
        ]);

        $updated = app(ServerNetworkService::class)->syncPublicIp($server);

        $this->assertTrue($updated);
        $this->assertSame('192.168.1.50', $server->fresh()->public_ip);
    }

    public function test_sync_public_ip_skips_when_ip_is_already_set(): void
    {
        $this->mock(ProcessRunner::class, function (MockInterface $mock): void {
            $mock->shouldReceive('run')->never();
        });

        $server = Server::factory()->create([
            'id' => 1,
            'public_ip' => '203.0.113.10',
        ]);

        $updated = app(ServerNetworkService::class)->syncPublicIp($server);

        $this->assertFalse($updated);
        $this->assertSame('203.0.113.10', $server->fresh()->public_ip);
    }
}
