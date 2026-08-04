<?php

namespace Tests\Feature\Databases;

use App\Models\Database;
use App\Models\Server;
use App\Models\User;
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
            $mock->shouldReceive('grant')->once()->with('app_user', 'app_production', 'all');
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
}
