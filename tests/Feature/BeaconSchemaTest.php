<?php

namespace Tests\Feature;

use App\Models\Deployment;
use App\Models\Server;
use App\Models\Site;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BeaconSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_site_factory_persists_with_uuid_and_server(): void
    {
        $site = Site::factory()->laravel()->create();

        $this->assertNotEmpty($site->uuid);
        $this->assertSame('laravel', $site->type);
        $this->assertInstanceOf(Server::class, $site->server);
        $this->assertSame(str_replace('.', '-', $site->name), $site->poolName());
    }

    public function test_deployment_belongs_to_site(): void
    {
        $deployment = Deployment::factory()->create();

        $this->assertInstanceOf(Site::class, $deployment->site);
        $this->assertNotEmpty($deployment->uuid);
    }

    public function test_activity_helper_records_an_event(): void
    {
        $site = Site::factory()->create();

        $log = activity()->on($site)->log('site.created');

        $this->assertDatabaseHas('activity_logs', [
            'id' => $log->id,
            'event' => 'site.created',
            'subject_type' => $site->getMorphClass(),
            'subject_id' => $site->id,
        ]);
    }
}
