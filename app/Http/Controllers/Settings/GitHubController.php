<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\GithubInstallation;
use App\Models\WebhookDelivery;
use App\Services\Github\GitHubAppClient;
use App\Services\Github\GitHubManifestFlow;
use App\Services\Github\WebhookReachability;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class GitHubController extends Controller
{
    public function edit(Request $request): Response
    {
        $installation = GithubInstallation::query()
            ->where('user_id', $request->user()->id)
            ->first();

        $deliveries = $installation
            ? WebhookDelivery::query()
                ->where('github_installation_id', $installation->id)
                ->latest('id')
                ->limit(20)
                ->get()
                ->map(fn (WebhookDelivery $delivery): array => [
                    'id' => $delivery->id,
                    'delivery_id' => $delivery->delivery_id,
                    'event' => $delivery->event,
                    'repository' => $delivery->repository,
                    'status_code' => $delivery->status_code,
                    'created_at' => $delivery->created_at?->toIso8601String(),
                    'redelivered_at' => $delivery->redelivered_at?->toIso8601String(),
                ])
            : collect();

        return Inertia::render('settings/github', [
            'manifest' => app(GitHubManifestFlow::class)->manifestPayload($request->user()),
            'installation' => $installation ? [
                'app_slug' => $installation->app_slug,
                'account_login' => $installation->account_login,
                'installation_id' => $installation->installation_id,
                'webhook_reachable' => $installation->webhook_reachable,
                'last_delivery_status' => $installation->last_delivery_status,
                'connected_at' => $installation->connected_at?->toIso8601String(),
                'install_url' => $installation->installation_id === null
                    ? "https://github.com/apps/{$installation->app_slug}/installations/new"
                    : null,
            ] : null,
            'deliveries' => $deliveries,
        ]);
    }

    public function callback(
        Request $request,
        GitHubManifestFlow $manifestFlow,
        GitHubAppClient $client,
    ): RedirectResponse {
        $request->validate([
            'code' => ['required', 'string'],
            'state' => ['required', 'string'],
        ]);

        $userId = $manifestFlow->userIdForState($request->query('state'));

        if ($userId !== $request->user()->id) {
            abort(403);
        }

        try {
            $converted = $client->convertManifest($request->query('code'));
            $installation = $manifestFlow->persistConversion($request->user(), $converted);
        } catch (RuntimeException $e) {
            return redirect()
                ->route('github.edit')
                ->withErrors(['github' => $e->getMessage()]);
        }

        return redirect()->away("https://github.com/apps/{$installation->app_slug}/installations/new");
    }

    public function setup(
        Request $request,
        GitHubManifestFlow $manifestFlow,
        WebhookReachability $reachability,
    ): RedirectResponse {
        $request->validate([
            'installation_id' => ['required', 'integer'],
        ]);

        $installation = GithubInstallation::query()
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        try {
            $manifestFlow->attachInstallation($installation, (int) $request->query('installation_id'));
            $reachability->refresh($installation);
        } catch (RuntimeException $e) {
            return redirect()
                ->route('github.edit')
                ->withErrors(['github' => $e->getMessage()]);
        }

        return redirect()
            ->route('github.edit')
            ->with('toast', ['type' => 'success', 'message' => 'GitHub App connected.']);
    }

    public function destroy(Request $request): RedirectResponse
    {
        GithubInstallation::query()
            ->where('user_id', $request->user()->id)
            ->delete();

        return redirect()
            ->route('github.edit')
            ->with('toast', ['type' => 'success', 'message' => 'GitHub App disconnected.']);
    }

    public function redeliver(
        Request $request,
        WebhookDelivery $delivery,
        GitHubAppClient $client,
        WebhookReachability $reachability,
    ): RedirectResponse {
        $installation = GithubInstallation::query()
            ->where('user_id', $request->user()->id)
            ->whereNotNull('installation_id')
            ->firstOrFail();

        abort_unless($delivery->github_installation_id === $installation->id, 404);

        try {
            $client->redeliverAppHookDelivery($installation, $delivery->delivery_id);
        } catch (RuntimeException $e) {
            return back()->withErrors(['github' => $e->getMessage()]);
        }

        $delivery->update(['redelivered_at' => now()]);
        $reachability->refresh($installation);

        return back()->with('toast', [
            'type' => 'success',
            'message' => 'Webhook delivery redelivered.',
        ]);
    }
}
