<?php

namespace Tests\Feature\Sites;

use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Models\User;
use App\Services\System\ProcessFactory;
use App\Services\System\SiteFilesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class DeployKeyTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_generate_deploy_key_stores_public_key_on_site(): void
    {
        $this->processFactory->willReturn(0);

        $this->mock(SiteFilesystem::class, function (MockInterface $mock): void {
            $mock->shouldReceive('read')
                ->once()
                ->andReturn('ssh-ed25519 AAAA beacon-app.example.com');
        });

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithDomain('app.example.com');

        $response = $this->actingAs($user)->post(route('sites.deploy-key.store', $site));

        $response->assertRedirect();

        $site->refresh();

        $this->assertNotNull($site->deploy_key_path);
        $this->assertSame('ssh-ed25519 AAAA beacon-app.example.com', $site->deploy_key_public);
    }

    private function createSiteWithDomain(string $name): Site
    {
        $site = Site::factory()->laravel()->create([
            'server_id' => 1,
            'name' => $name,
            'path' => '/home/beacon/'.$name,
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => $name,
            'is_primary' => true,
        ]);

        return $site;
    }
}
