<?php

namespace Tests\Feature\Sites;

use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Models\User;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class DomainSettingsTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->processFactory->willReturn(0, "server { listen 80; }\n");
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_wildcard_subdomains_setting_can_be_updated(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = Site::factory()->create([
            'server_id' => 1,
            'name' => 'app.example.com',
            'allow_wildcard_subdomains' => false,
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => $site->name,
            'is_primary' => true,
        ]);

        $this->actingAs($user)
            ->patch(route('sites.domains.settings', $site), [
                'allow_wildcard_subdomains' => true,
            ])
            ->assertRedirect();

        $this->assertTrue($site->fresh()->allow_wildcard_subdomains);
    }
}
