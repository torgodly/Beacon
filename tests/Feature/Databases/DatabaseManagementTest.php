<?php

namespace Tests\Feature\Databases;

use App\Models\Database;
use App\Models\DatabaseUser;
use App\Models\Server;
use App\Models\Site;
use App\Models\User;
use App\Services\Database\MySqlRemoteAccessService;
use App\Services\Database\MySqlService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class DatabaseManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_store_creates_database_record(): void
    {
        $this->mock(MySqlService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('createDatabase')->once()->with('app_production');
        });

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $response = $this->actingAs($user)->post(route('databases.store'), [
            'name' => 'app_production',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('databases', [
            'name' => 'app_production',
            'server_id' => 1,
        ]);
    }

    public function test_store_user_creates_user_and_grants_access(): void
    {
        $this->mock(MySqlService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('createUser')->once();
            $mock->shouldReceive('grant')->once()->with('app_user', 'app_production', 'all', 'localhost');
        });

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $database = Database::factory()->create([
            'server_id' => 1,
            'name' => 'app_production',
        ]);

        $response = $this->actingAs($user)->post(route('database-users.store'), [
            'username' => 'app_user',
            'database_id' => $database->id,
            'privileges' => 'all',
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('database_user_password');
        $this->assertDatabaseHas('database_users', [
            'username' => 'app_user',
            'server_id' => 1,
        ]);
    }

    public function test_store_user_requires_privileges_when_database_is_selected(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $database = Database::factory()->create([
            'server_id' => 1,
            'name' => 'app_production',
        ]);

        $response = $this->actingAs($user)->post(route('database-users.store'), [
            'username' => 'app_user',
            'database_id' => $database->id,
        ]);

        $response->assertSessionHasErrors('privileges');
    }

    public function test_store_user_rejects_databases_from_another_server(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        Server::factory()->create(['id' => 2]);

        $foreign = Database::factory()->create([
            'server_id' => 2,
            'name' => 'other_server_db',
        ]);

        $response = $this->actingAs($user)->post(route('database-users.store'), [
            'username' => 'app_user',
            'database_id' => $foreign->id,
            'privileges' => 'all',
        ]);

        $response->assertSessionHasErrors('database_id');
    }

    public function test_destroy_user_removes_database_user(): void
    {
        $this->mock(MySqlService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('revokeAll')->once()->with('app_user', 'app_production', 'localhost');
            $mock->shouldReceive('dropUser')->once()->with('app_user', 'localhost');
        });

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $database = Database::factory()->create([
            'server_id' => 1,
            'name' => 'app_production',
        ]);

        $databaseUser = DatabaseUser::factory()->create([
            'server_id' => 1,
            'username' => 'app_user',
        ]);

        $databaseUser->databases()->attach($database->id, ['privileges' => 'all']);

        $response = $this->actingAs($user)->delete(route('database-users.destroy', $databaseUser));

        $response->assertRedirect();
        $this->assertDatabaseMissing('database_users', ['id' => $databaseUser->id]);
    }

    public function test_destroy_user_is_blocked_when_linked_to_a_site(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $database = Database::factory()->create(['server_id' => 1]);
        $databaseUser = DatabaseUser::factory()->create(['server_id' => 1]);

        $site = Site::factory()->create([
            'server_id' => 1,
            'database_id' => $database->id,
            'database_user_id' => $databaseUser->id,
        ]);

        $response = $this->actingAs($user)->delete(route('database-users.destroy', $databaseUser));

        $response->assertSessionHasErrors('database_user');
        $this->assertDatabaseHas('database_users', ['id' => $databaseUser->id]);
        $this->assertDatabaseHas('sites', ['id' => $site->id]);
    }

    public function test_store_can_create_remote_database(): void
    {
        $this->mock(MySqlService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('createDatabase')->once()->with('remote_app');
        });

        $this->mock(MySqlRemoteAccessService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('sync')->once();
        });

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $response = $this->actingAs($user)->post(route('databases.store'), [
            'name' => 'remote_app',
            'allow_remote' => true,
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('databases', [
            'name' => 'remote_app',
            'allow_remote' => true,
        ]);
    }

    public function test_store_user_for_remote_database_uses_wildcard_host(): void
    {
        $this->mock(MySqlService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('createUser')->once();
            $mock->shouldReceive('grant')->once()->with('remote_user', 'remote_app', 'all', '%');
        });

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $database = Database::factory()->create([
            'server_id' => 1,
            'name' => 'remote_app',
            'allow_remote' => true,
        ]);

        $response = $this->actingAs($user)->post(route('database-users.store'), [
            'username' => 'remote_user',
            'database_id' => $database->id,
            'privileges' => 'all',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('database_users', [
            'username' => 'remote_user',
            'host' => '%',
        ]);
    }

    public function test_update_access_toggles_remote_flag_and_syncs_mysql(): void
    {
        $this->mock(MySqlRemoteAccessService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('sync')->once();
        });

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $database = Database::factory()->create([
            'server_id' => 1,
            'allow_remote' => false,
        ]);

        $response = $this->actingAs($user)->patch(route('databases.access.update', $database), [
            'allow_remote' => true,
        ]);

        $response->assertRedirect();
        $this->assertTrue($database->fresh()->allow_remote);
    }

    public function test_update_access_can_toggle_off_when_remote_users_exist(): void
    {
        $this->mock(MySqlRemoteAccessService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('sync')->once();
        });

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $database = Database::factory()->create([
            'server_id' => 1,
            'allow_remote' => true,
        ]);

        DatabaseUser::factory()->create([
            'server_id' => 1,
            'username' => 'remote_user',
            'host' => '%',
        ])->databases()->attach($database->id, ['privileges' => 'all']);

        $response = $this->actingAs($user)->patch(route('databases.access.update', $database), [
            'allow_remote' => false,
        ]);

        $response->assertRedirect();
        $this->assertFalse($database->fresh()->allow_remote);
    }
}
