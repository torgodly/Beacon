<?php

namespace Database\Factories;

use App\Models\Server;
use App\Models\Site;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Site>
 */
class SiteFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->domainName();

        return [
            'uuid' => (string) Str::uuid(),
            'server_id' => Server::factory(),
            'name' => $name,
            'type' => fake()->randomElement(['laravel', 'nextjs', 'nuxt', 'static']),
            'path' => '/home/beacon/'.$name,
            'web_directory' => '/public',
            'system_user' => 'beacon',
            'php_version' => '8.4',
            'node_version' => null,
            'package_manager' => 'npm',
            'proxy_port' => null,
            'spa_fallback' => false,
            'client_max_body_size' => '100M',
            'open_basedir' => true,
            'open_basedir_extra_paths' => null,
            'strict_functions' => false,
            'auto_deploy' => false,
            'deploy_trigger' => 'manual',
            'deployment_status' => 'idle',
            'nginx_customized' => false,
            'ssl_status' => 'none',
            'status' => 'active',
        ];
    }

    public function laravel(): static
    {
        return $this->state(fn (): array => [
            'type' => 'laravel',
            'php_version' => '8.4',
            'node_version' => null,
            'proxy_port' => null,
        ]);
    }

    public function nextjs(): static
    {
        return $this->state(fn (): array => [
            'type' => 'nextjs',
            'php_version' => null,
            'node_version' => '22',
            'proxy_port' => fake()->numberBetween(3000, 3999),
        ]);
    }
}
