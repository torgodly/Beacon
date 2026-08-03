<?php

namespace Tests\Feature\Settings;

use App\Models\GithubInstallation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class GitHubSettingsTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function guests_are_redirected_from_github_settings(): void
    {
        $this->get(route('github.edit'))->assertRedirect(route('login'));
    }

    #[Test]
    public function verified_users_can_view_github_settings(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get(route('github.edit'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('settings/github')
                ->has('manifest')
                ->where('installation', null));
    }

    #[Test]
    public function disconnect_removes_the_installation(): void
    {
        $user = User::factory()->create();
        GithubInstallation::factory()->installed()->create(['user_id' => $user->id]);

        $this->actingAs($user)
            ->delete(route('github.destroy'))
            ->assertRedirect(route('github.edit'));

        $this->assertDatabaseMissing('github_installations', [
            'user_id' => $user->id,
        ]);
    }

    #[Test]
    public function redeliver_marks_delivery_as_redelivered(): void
    {
        $user = User::factory()->create();
        $installation = GithubInstallation::factory()->installed()->create([
            'user_id' => $user->id,
        ]);

        $delivery = $installation->webhookDeliveries()->create([
            'delivery_id' => 'abc123',
            'event' => 'push',
            'repository' => 'acme/app',
            'status_code' => 200,
            'payload_digest' => hash('sha256', 'payload'),
        ]);

        Http::fake([
            'api.github.com/*' => Http::response([], 201),
        ]);

        $this->actingAs($user)
            ->from(route('github.edit'))
            ->post(route('github.deliveries.redeliver', $delivery))
            ->assertRedirect(route('github.edit'));

        $this->assertNotNull($delivery->fresh()->redelivered_at);
    }
}
