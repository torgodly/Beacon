<?php

namespace Database\Factories;

use App\Models\GithubInstallation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GithubInstallation>
 */
class GithubInstallationFactory extends Factory
{
    protected $model = GithubInstallation::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'app_id' => fake()->numberBetween(100000, 999999),
            'app_slug' => 'beacon-'.fake()->unique()->slug(2),
            'client_id' => fake()->uuid(),
            'client_secret' => fake()->sha256(),
            'private_key' => $this->samplePrivateKey(),
            'webhook_secret' => fake()->sha256(),
            'installation_id' => fake()->numberBetween(100000, 999999),
            'account_login' => fake()->userName(),
            'account_type' => 'User',
            'permissions' => ['contents' => 'read', 'metadata' => 'read'],
            'webhook_url' => 'http://localhost/webhooks/github',
            'webhook_reachable' => true,
            'connected_at' => now(),
        ];
    }

    public function installed(): static
    {
        return $this->state(fn (): array => [
            'installation_id' => fake()->numberBetween(100000, 999999),
        ]);
    }

    private function samplePrivateKey(): string
    {
        $resource = openssl_pkey_new([
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
            'private_key_bits' => 2048,
        ]);

        if ($resource === false) {
            throw new \RuntimeException('Could not generate OpenSSL private key for factory.');
        }

        openssl_pkey_export($resource, $privateKey);

        return $privateKey;
    }
}
