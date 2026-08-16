<?php

namespace App\Http\Controllers\Sites;

use App\Http\Controllers\Controller;
use App\Models\GithubInstallation;
use App\Services\Deployment\GitService;
use App\Services\Github\GitHubAppClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class GitHubBrowseController extends Controller
{
    public function repositories(Request $request, GitHubAppClient $client): JsonResponse
    {
        $installation = $this->installationFor($request);

        abort_unless($installation !== null && $installation->installation_id !== null, 404);

        try {
            $repositories = $client->listRepositories($installation);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['repositories' => $repositories]);
    }

    public function branches(
        Request $request,
        GitHubAppClient $client,
        string $owner,
        string $repo,
    ): JsonResponse {
        $installation = $this->installationFor($request);

        abort_unless($installation !== null && $installation->installation_id !== null, 404);

        try {
            $branches = $client->listBranches($installation, $owner, $repo);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['branches' => $branches]);
    }

    public function remoteBranches(Request $request, GitService $git): JsonResponse
    {
        $validated = $request->validate([
            'repository' => ['required', 'string', 'max:500'],
        ]);

        try {
            $branches = $git->listRemoteBranches(
                (string) $validated['repository'],
                $this->installationFor($request),
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'branches' => array_map(
                fn (string $name): array => ['name' => $name],
                $branches,
            ),
        ]);
    }

    private function installationFor(Request $request): ?GithubInstallation
    {
        return GithubInstallation::query()
            ->where('user_id', $request->user()?->id)
            ->whereNotNull('installation_id')
            ->first();
    }
}
