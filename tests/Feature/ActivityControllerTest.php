<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivityControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_activity_index_lists_recent_logs(): void
    {
        $user = User::factory()->create();

        ActivityLog::factory()->create([
            'user_id' => $user->id,
            'event' => 'database.created',
            'properties' => ['name' => 'app_db'],
        ]);

        $response = $this->actingAs($user)->get(route('activity.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('activity/index')
            ->has('logs', 1)
            ->where('logs.0.event', 'database.created')
        );
    }
}
