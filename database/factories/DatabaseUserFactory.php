<?php

namespace Database\Factories;

use App\Models\DatabaseUser;
use App\Models\Server;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DatabaseUser>
 */
class DatabaseUserFactory extends Factory
{
    protected $model = DatabaseUser::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'server_id' => Server::factory(),
            'username' => fake()->unique()->userName(),
            'password' => fake()->password(16),
            'host' => 'localhost',
            'status' => 'active',
        ];
    }
}
