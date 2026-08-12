<?php

namespace Tests\Feature\Databases;

use App\Models\Database;
use App\Models\DatabaseBackup;
use App\Models\DatabaseUser;
use App\Models\Server;
use App\Models\User;
use App\Services\Database\DatabaseBackupService;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class DatabaseBackupTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_backup_can_be_queued_and_completes(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $database = Database::factory()->create([
            'server_id' => 1,
            'name' => 'app_production',
        ]);

        $response = $this->actingAs($user)->post(route('databases.backups.store', $database));

        $response->assertRedirect();

        $backup = DatabaseBackup::query()->first();
        $this->assertNotNull($backup);
        $this->assertSame('success', $backup->status);
    }

    public function test_signed_download_route_serves_backup(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $database = Database::factory()->create(['server_id' => 1]);
        $path = storage_path('framework/testing/backups/download-test.sql.gz');
        file_put_contents($path, 'gzip-data');

        $backup = DatabaseBackup::factory()->create([
            'database_id' => $database->id,
            'path' => $path,
            'status' => 'success',
        ]);

        $url = URL::temporarySignedRoute('database-backups.download', now()->addHour(), [
            'backup' => $backup->uuid,
        ]);

        $response = $this->actingAs($user)->get($url);

        $response->assertOk();
        $response->assertDownload($backup->filename);
    }

    public function test_connection_strings_include_linked_users(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $database = Database::factory()->create([
            'server_id' => 1,
            'name' => 'app_production',
        ]);

        $dbUser = DatabaseUser::factory()->create([
            'server_id' => 1,
            'username' => 'app_user',
        ]);

        $database->users()->attach($dbUser->id, ['privileges' => 'all']);

        $service = app(DatabaseBackupService::class);
        $connections = $service->connectionStrings($database);

        $this->assertCount(1, $connections);
        $this->assertStringContainsString('DB_DATABASE=app_production', $connections[0]['laravel']);
        $this->assertStringContainsString('DB_USERNAME=app_user', $connections[0]['laravel']);
        $this->assertStringStartsWith('tableplus://connections/new?', $connections[0]['tableplus']);
        $this->assertStringContainsString('database=app_production', $connections[0]['tableplus']);
        $this->assertStringContainsString('user=app_user', $connections[0]['tableplus']);
        $this->assertSame('127.0.0.1', $connections[0]['connect_host']);
        $this->assertFalse($connections[0]['remote']);
    }

    public function test_connection_strings_use_public_ip_when_remote_is_enabled(): void
    {
        Server::factory()->create([
            'id' => 1,
            'public_ip' => '203.0.113.50',
        ]);

        $database = Database::factory()->create([
            'server_id' => 1,
            'name' => 'app_production',
            'allow_remote' => true,
        ]);

        $dbUser = DatabaseUser::factory()->create([
            'server_id' => 1,
            'username' => 'app_user',
            'host' => '%',
            'password' => 'secret',
        ]);

        $database->users()->attach($dbUser->id, ['privileges' => 'all']);

        $connections = app(DatabaseBackupService::class)->connectionStrings($database);

        $this->assertSame('203.0.113.50', $connections[0]['connect_host']);
        $this->assertTrue($connections[0]['remote']);
        $this->assertStringContainsString('@203.0.113.50:3306/', $connections[0]['url']);
        $this->assertStringContainsString('host=203.0.113.50', $connections[0]['tableplus']);
    }
}
