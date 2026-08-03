<?php

namespace Database\Factories;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Model;

/**
 * @extends Factory<ActivityLog>
 */
class ActivityLogFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'subject_type' => null,
            'subject_id' => null,
            'event' => fake()->randomElement(['site.created', 'site.deleted', 'nginx.saved', 'deployment.finished']),
            'description' => fake()->sentence(),
            'properties' => null,
            'ip_address' => fake()->ipv4(),
            'user_agent' => fake()->userAgent(),
            'created_at' => now(),
        ];
    }

    /**
     * Attach this activity to a specific subject model.
     */
    public function forSubject(Model $subject): static
    {
        return $this->state(fn (array $attributes): array => [
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => $subject->getKey(),
        ]);
    }

    /**
     * Indicate the activity was not performed by an authenticated user (e.g. system/cron).
     */
    public function system(): static
    {
        return $this->state(fn (array $attributes): array => [
            'user_id' => null,
        ]);
    }
}
