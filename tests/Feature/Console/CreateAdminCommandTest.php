<?php

namespace Tests\Feature\Console;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CreateAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_an_administrator_from_options(): void
    {
        $this->artisan('beacon:create-admin', [
            '--name' => 'Jane Admin',
            '--email' => 'jane@example.test',
            '--password' => 'super-secret-password',
        ])->assertSuccessful();

        $this->assertDatabaseCount('users', 1);

        $user = User::query()->sole();

        $this->assertSame('Jane Admin', $user->name);
        $this->assertSame('jane@example.test', $user->email);
        $this->assertNotNull($user->email_verified_at);
        $this->assertTrue(Hash::check('super-secret-password', $user->password));
    }

    public function test_it_refuses_to_create_a_second_administrator_without_force(): void
    {
        User::factory()->create();

        $this->artisan('beacon:create-admin', [
            '--name' => 'Second Admin',
            '--email' => 'second@example.test',
            '--password' => 'super-secret-password',
        ])->assertFailed();

        $this->assertDatabaseCount('users', 1);
    }

    public function test_it_creates_another_administrator_when_forced(): void
    {
        User::factory()->create();

        $this->artisan('beacon:create-admin', [
            '--name' => 'Second Admin',
            '--email' => 'second@example.test',
            '--password' => 'super-secret-password',
            '--force' => true,
        ])->assertSuccessful();

        $this->assertDatabaseCount('users', 2);
    }

    public function test_it_rejects_invalid_input(): void
    {
        $this->artisan('beacon:create-admin', [
            '--name' => 'Jane Admin',
            '--email' => 'not-an-email',
            '--password' => 'super-secret-password',
        ])->assertFailed();

        $this->assertDatabaseCount('users', 0);
    }
}
