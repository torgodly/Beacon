<?php

namespace Tests\Feature\Webhooks;

use App\Jobs\RunDeployment;
use App\Models\GithubInstallation;
use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Models\User;
use App\Models\WebhookDelivery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class GitHubWebhookTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_rejects_requests_without_a_signature(): void
    {
        $response = $this->postJson(route('webhooks.github'), ['zen' => 'test']);

        $response->assertUnauthorized();
    }

    #[Test]
    public function it_accepts_a_signed_ping(): void
    {
        $installation = GithubInstallation::factory()->installed()->create();
        $payload = json_encode(['zen' => 'test'], JSON_THROW_ON_ERROR);
        $signature = $this->signatureFor($payload, $installation->webhook_secret);

        $response = $this->signedRequest($payload, $signature, 'ping');

        $response->assertAccepted();

        $this->assertDatabaseHas('webhook_deliveries', [
            'github_installation_id' => $installation->id,
            'event' => 'ping',
            'status_code' => 202,
        ]);

        $installation->refresh();

        $this->assertTrue($installation->webhook_reachable);
        $this->assertSame(202, $installation->last_delivery_status);
    }

    #[Test]
    public function it_queues_deployments_for_matching_push_events(): void
    {
        Queue::fake();

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $installation = GithubInstallation::factory()->installed()->create([
            'user_id' => $user->id,
        ]);

        $site = Site::factory()->laravel()->create([
            'server_id' => 1,
            'name' => 'app.example.com',
            'path' => '/home/beacon/app.example.com',
            'github_installation_id' => $installation->id,
            'github_repo_id' => 987654,
            'repository' => 'acme/app',
            'repository_provider' => 'github',
            'repository_branch' => 'main',
            'auto_deploy' => true,
            'deploy_trigger' => 'webhook',
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => 'app.example.com',
            'is_primary' => true,
        ]);

        $payload = json_encode([
            'ref' => 'refs/heads/main',
            'after' => str_repeat('a', 40),
            'repository' => [
                'id' => 987654,
                'full_name' => 'acme/app',
            ],
        ], JSON_THROW_ON_ERROR);

        $signature = $this->signatureFor($payload, $installation->webhook_secret);

        $response = $this->signedRequest($payload, $signature, 'push');

        $response->assertAccepted();

        Queue::assertPushed(RunDeployment::class);

        $this->assertSame(1, WebhookDelivery::query()->count());
    }

    private function signatureFor(string $payload, string $secret): string
    {
        return 'sha256='.hash_hmac('sha256', $payload, $secret);
    }

    private function signedRequest(string $payload, string $signature, string $event)
    {
        return $this->call(
            'POST',
            route('webhooks.github'),
            [],
            [],
            [],
            [
                'HTTP_X-Hub-Signature-256' => $signature,
                'HTTP_X-GitHub-Event' => $event,
                'HTTP_X-GitHub-Delivery' => 'delivery-test-1',
                'CONTENT_TYPE' => 'application/json',
            ],
            $payload,
        );
    }
}
