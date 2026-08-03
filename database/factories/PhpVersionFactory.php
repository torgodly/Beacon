<?php

namespace Database\Factories;

use App\Models\PhpVersion;
use App\Models\Server;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PhpVersion>
 */
class PhpVersionFactory extends Factory
{
    protected $model = PhpVersion::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'server_id' => Server::factory(),
            'version' => fake()->randomElement(config('beacon.php_versions')),
            'status' => 'installed',
            'is_default' => false,
            'installed_at' => now(),
            'last_error' => null,
        ];
    }

    public function default(): static
    {
        return $this->state(fn (): array => [
            'is_default' => true,
        ]);
    }
}
