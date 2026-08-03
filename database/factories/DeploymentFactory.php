<?php

namespace Database\Factories;

use App\Models\Deployment;
use App\Models\Site;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Deployment>
 */
class DeploymentFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'uuid' => (string) Str::uuid(),
            'site_id' => Site::factory(),
            'user_id' => null,
            'trigger' => fake()->randomElement(['manual', 'webhook', 'poll', 'api', 'redeploy']),
            'status' => 'queued',
            'branch' => 'main',
            'commit_sha' => fake()->sha1(),
            'commit_message' => fake()->sentence(),
            'commit_author' => fake()->name(),
            'commit_url' => fake()->url(),
            'log_path' => '/var/log/beacon/deployments/'.Str::uuid().'.log',
        ];
    }
}
