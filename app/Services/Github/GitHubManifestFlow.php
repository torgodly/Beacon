<?php

namespace App\Services\Github;

use App\Models\GithubInstallation;
use App\Models\Server;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use RuntimeException;

class GitHubManifestFlow
{
    public function __construct(private readonly GitHubAppClient $client) {}

    /**
     * @return array{state: string, manifest: array<string, mixed>}
     */
    public function manifestRegistration(User $user): array
    {
        $state = Str::random(40);
        Cache::put($this->stateKey($state), $user->id, now()->addHour());

        $baseUrl = Server::current()->panelBaseUrl();

        return [
            'state' => $state,
            'manifest' => [
                'name' => config('beacon.github.app_name'),
                'url' => $baseUrl,
                'hook_attributes' => [
                    'url' => $this->absoluteRoute('webhooks.github', $baseUrl),
                ],
                // GitHub validates redirect_url without query params; state is sent
                // separately on the form action per their manifest flow docs.
                'redirect_url' => $this->absoluteRoute('github.callback', $baseUrl),
                'setup_url' => $this->absoluteRoute('github.setup', $baseUrl),
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
        $baseUrl = Server::current()->panelBaseUrl();

        return GithubInstallation::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'app_id' => (int) $manifest['id'],
                'app_slug' => (string) $manifest['slug'],
                'client_id' => (string) $manifest['client_id'],
                'client_secret' => (string) $manifest['client_secret'],
                'private_key' => (string) $manifest['pem'],
                'webhook_secret' => (string) $manifest['webhook_secret'],
                'webhook_url' => $this->absoluteRoute('webhooks.github', $baseUrl),
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

    /**
     * @param  array<string, mixed>  $parameters
     */
    private function absoluteRoute(string $name, string $baseUrl, array $parameters = []): string
    {
        $path = route($name, $parameters, absolute: false);
        $url = rtrim($baseUrl, '/').$path;

        if (filter_var($url, FILTER_VALIDATE_URL) === false) {
            throw new RuntimeException(
                "Could not build a valid URL for [{$name}]. Check the panel URL in Settings → Server.",
            );
        }

        return $url;
    }

    private function stateKey(string $state): string
    {
        return "github:manifest-state:{$state}";
    }
}
