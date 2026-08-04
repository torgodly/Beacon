<?php

namespace Tests\Unit\Support;

use App\Models\Server;
use App\Services\Github\WebhookReachability;
use App\Support\SiteDeploySettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class SiteDeploySettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_repository_is_required_for_auto_deploy(): void
    {
        $normalized = SiteDeploySettings::normalize([
            'repository' => null,
            'auto_deploy' => true,
        ]);

        $this->assertFalse($normalized['auto_deploy']);
        $this->assertSame('manual', $normalized['deploy_trigger']);
    }

    public function test_auto_deploy_off_keeps_manual_trigger(): void
    {
        $normalized = SiteDeploySettings::normalize([
            'repository' => 'git@github.com:org/app.git',
            'auto_deploy' => false,
        ]);

        $this->assertFalse($normalized['auto_deploy']);
        $this->assertSame('manual', $normalized['deploy_trigger']);
    }

    public function test_github_auto_deploy_uses_webhook_when_reachable(): void
    {
        Server::factory()->create(['id' => 1]);

        $this->mock(WebhookReachability::class, function (MockInterface $mock): void {
            $mock->shouldReceive('canReceiveWebhooks')->once()->andReturnTrue();
        });

        $normalized = SiteDeploySettings::normalize([
            'repository' => 'git@github.com:org/app.git',
            'auto_deploy' => true,
            'github_installation_id' => 7,
        ]);

        $this->assertTrue($normalized['auto_deploy']);
        $this->assertSame('webhook', $normalized['deploy_trigger']);
    }

    public function test_github_auto_deploy_falls_back_to_poll_when_webhooks_unavailable(): void
    {
        Server::factory()->create(['id' => 1]);

        $this->mock(WebhookReachability::class, function (MockInterface $mock): void {
            $mock->shouldReceive('canReceiveWebhooks')->once()->andReturnFalse();
        });

        $normalized = SiteDeploySettings::normalize([
            'repository' => 'git@github.com:org/app.git',
            'auto_deploy' => true,
            'github_installation_id' => 7,
        ]);

        $this->assertTrue($normalized['auto_deploy']);
        $this->assertSame('poll', $normalized['deploy_trigger']);
    }

    public function test_custom_repository_auto_deploy_polls(): void
    {
        $normalized = SiteDeploySettings::normalize([
            'repository' => 'git@github.com:org/app.git',
            'auto_deploy' => true,
        ]);

        $this->assertTrue($normalized['auto_deploy']);
        $this->assertSame('poll', $normalized['deploy_trigger']);
    }
}
