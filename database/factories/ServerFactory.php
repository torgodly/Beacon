<?php

namespace Database\Factories;

use App\Models\Server;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Server>
 */
class ServerFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'hostname' => fake()->domainName(),
            'public_ip' => fake()->ipv4(),
            'private_ip' => fake()->optional()->ipv4(),
            'os_release' => 'Ubuntu 24.04 LTS',
            'beacon_version' => '0.1.0',
            'timezone' => 'UTC',
            'panel_domain' => null,
            'panel_port' => 8443,
            'panel_url_public' => false,
            'wildcard_domain' => null,
            'default_php_version' => '8.4',
            'default_node_version' => '22',
            'default_package_manager' => 'npm',
            'total_memory_mb' => 4096,
            'swap_mb' => 2048,
            'settings' => null,
            'provisioned_at' => now(),
        ];
    }
}
