<?php

namespace App\Services\Github;

use App\Models\GithubInstallation;
use App\Support\GitHubJwt;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class GitHubAppClient
{
    private const string API = 'https://api.github.com';

    /**
     * @return array<string, mixed>
     */
    public function convertManifest(string $code): array
    {
        $response = Http::acceptJson()
            ->post(self::API."/app-manifests/{$code}/conversions");

        if ($response->failed()) {
            throw new RuntimeException($response->json('message') ?? 'Manifest conversion failed.');
        }

        return $response->json();
    }

    /**
     * @return array<string, mixed>
     */
    public function fetchInstallation(GithubInstallation $installation): array
    {
        $response = $this->appRequest($installation)
            ->get(self::API."/app/installations/{$installation->installation_id}");

        if ($response->failed()) {
            throw new RuntimeException($response->json('message') ?? 'Could not load installation.');
        }

        return $response->json();
    }

    /**
     * @return list<array{id: int, full_name: string, clone_url: string, ssh_url: string, default_branch: string|null}>
     */
    public function listRepositories(GithubInstallation $installation, int $page = 1): array
    {
        $response = $this->installationRequest($installation)
            ->get(self::API.'/installation/repositories', [
                'per_page' => 100,
                'page' => $page,
            ]);

        if ($response->failed()) {
            throw new RuntimeException($response->json('message') ?? 'Could not list repositories.');
        }

        /** @var list<array<string, mixed>> $repositories */
        $repositories = $response->json('repositories') ?? [];

        return array_map(fn (array $repo): array => [
            'id' => (int) $repo['id'],
            'full_name' => (string) $repo['full_name'],
            'clone_url' => (string) $repo['clone_url'],
            'ssh_url' => (string) $repo['ssh_url'],
            'default_branch' => isset($repo['default_branch']) ? (string) $repo['default_branch'] : null,
        ], $repositories);
    }

    /**
     * @return list<array{name: string}>
     */
    public function listBranches(GithubInstallation $installation, string $owner, string $repo): array
    {
        $response = $this->installationRequest($installation)
            ->get(self::API."/repos/{$owner}/{$repo}/branches", [
                'per_page' => 100,
            ]);

        if ($response->failed()) {
            throw new RuntimeException($response->json('message') ?? 'Could not list branches.');
        }

        /** @var list<array<string, mixed>> $branches */
        $branches = $response->json() ?? [];

        return array_map(fn (array $branch): array => [
            'name' => (string) $branch['name'],
        ], $branches);
    }

    /**
     * @param  array<string, mixed>  $config
     */
    public function patchAppHookConfig(GithubInstallation $installation, array $config): void
    {
        $response = $this->appRequest($installation)
            ->patch(self::API.'/app/hook/config', $config);

        if ($response->failed()) {
            throw new RuntimeException($response->json('message') ?? 'Could not update webhook config.');
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listAppHookDeliveries(GithubInstallation $installation, int $limit = 5): array
    {
        $response = $this->appRequest($installation)
            ->get(self::API.'/app/hook/deliveries', ['per_page' => $limit]);

        if ($response->failed()) {
            return [];
        }

        /** @var list<array<string, mixed>> */
        return $response->json() ?? [];
    }

    public function redeliverAppHookDelivery(GithubInstallation $installation, string $deliveryId): void
    {
        $response = $this->appRequest($installation)
            ->post(self::API."/app/hook/deliveries/{$deliveryId}/attempts");

        if ($response->failed()) {
            throw new RuntimeException($response->json('message') ?? 'Could not redeliver webhook.');
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function createCommitStatus(
        GithubInstallation $installation,
        string $owner,
        string $repo,
        string $sha,
        array $payload,
    ): void {
        $this->installationRequest($installation)
            ->post(self::API."/repos/{$owner}/{$repo}/statuses/{$sha}", $payload);
    }

    public function installationToken(GithubInstallation $installation): string
    {
        if ($installation->installation_id === null) {
            throw new RuntimeException('GitHub App is not installed on an account yet.');
        }

        return Cache::remember(
            "github:installation-token:{$installation->id}",
            now()->addMinutes(50),
            function () use ($installation): string {
                $response = $this->appRequest($installation)
                    ->post(self::API."/app/installations/{$installation->installation_id}/access_tokens");

                if ($response->failed()) {
                    throw new RuntimeException($response->json('message') ?? 'Could not create installation token.');
                }

                return (string) $response->json('token');
            },
        );
    }

    private function appRequest(GithubInstallation $installation): PendingRequest
    {
        $jwt = GitHubJwt::forApp($installation->app_id, $installation->private_key);

        return Http::acceptJson()
            ->withToken($jwt, 'Bearer')
            ->withHeaders([
                'X-GitHub-Api-Version' => '2022-11-28',
            ]);
    }

    private function installationRequest(GithubInstallation $installation): PendingRequest
    {
        return Http::acceptJson()
            ->withToken($this->installationToken($installation))
            ->withHeaders([
                'X-GitHub-Api-Version' => '2022-11-28',
            ]);
    }
}
