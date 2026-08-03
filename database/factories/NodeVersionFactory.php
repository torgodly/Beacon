<?php

namespace Database\Factories;

use App\Models\NodeVersion;
use App\Models\Server;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<NodeVersion>
 */
class NodeVersionFactory extends Factory
{
    protected $model = NodeVersion::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'server_id' => Server::factory(),
            'runtime' => 'node',
            'version' => fake()->randomElement(config('beacon.node_versions', ['22'])),
            'path' => '/usr/local/node/v22/bin',
            'is_default' => false,
            'status' => 'installed',
        ];
    }
}
