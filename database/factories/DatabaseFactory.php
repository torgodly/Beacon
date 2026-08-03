<?php

namespace Database\Factories;

use App\Models\Database;
use App\Models\Server;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Database>
 */
class DatabaseFactory extends Factory
{
    protected $model = Database::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'server_id' => Server::factory(),
            'name' => fake()->unique()->userName().'_'.fake()->numerify('####'),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'status' => 'active',
        ];
    }
}
