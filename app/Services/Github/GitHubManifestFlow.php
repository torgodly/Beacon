<?php

namespace App\Services\Github;

use App\Models\GithubInstallation;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class GitHubManifestFlow
{
    public function __construct(private readonly GitHubAppClient $client) {}

    /**
     * @return array<string, mixed>
     */
    public function manifestPayload(User $user): array
    {
        $state = Str::random(40);
        Cache::put($this->stateKey($state), $user->id, now()->addHour());

        return [
            'name' => config('beacon.github.app_name'),
            'url' => config('app.url'),
            'hook_attributes' => [
                'url' => route('webhooks.github'),
            ],
            'redirect_url' => route('github.callback', ['state' => $state]),
            'setup_url' => route('github.setup'),
            'public' => false,
            'default_permissions' => [
                'contents' => 'read',
                'metadata' => 'read',
                'deployments' => 'write',
            ],
            'default_events' => [
                'push',
                'ping',
            ],
        ];
    }

    public function userIdForState(string $state): ?int
    {
        $userId = Cache::pull($this->stateKey($state));

        return is_int($userId) ? $userId : (is_numeric($userId) ? (int) $userId : null);
    }

    /**
     * @param  array<string, mixed>  $manifest
     */
    public function persistConversion(User $user, array $manifest): GithubInstallation
    {
        return GithubInstallation::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'app_id' => (int) $manifest['id'],
                'app_slug' => (string) $manifest['slug'],
                'client_id' => (string) $manifest['client_id'],
                'client_secret' => (string) $manifest['client_secret'],
                'private_key' => (string) $manifest['pem'],
                'webhook_secret' => (string) $manifest['webhook_secret'],
                'webhook_url' => route('webhooks.github'),
                'connected_at' => now(),
            ],
        );
    }

    public function attachInstallation(GithubInstallation $installation, int $installationId): GithubInstallation
    {
        $installation->update(['installation_id' => $installationId]);

        $details = $this->client->fetchInstallation($installation->fresh());

        $installation->update([
            'account_login' => $details['account']['login'] ?? null,
            'account_type' => $details['account']['type'] ?? null,
            'permissions' => $details['permissions'] ?? null,
            'connected_at' => now(),
        ]);

        return $installation->fresh();
    }

    private function stateKey(string $state): string
    {
        return "github:manifest-state:{$state}";
    }
}
