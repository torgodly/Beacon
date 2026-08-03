<?php

namespace App\Http\Controllers\Sites;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateSiteEnvironmentRequest;
use App\Models\EnvSnapshot;
use App\Models\Site;
use App\Services\Sites\SiteEnvironmentService;
use Illuminate\Http\RedirectResponse;
use RuntimeException;

class EnvironmentController extends Controller
{
    public function update(
        UpdateSiteEnvironmentRequest $request,
        Site $site,
        SiteEnvironmentService $environment,
    ): RedirectResponse {
        try {
            $environment->write(
                $site,
                $request->user(),
                $request->validated('contents'),
            );
        } catch (RuntimeException $e) {
            return back()->withErrors(['environment' => $e->getMessage()]);
        }

        return back()->with('toast', ['type' => 'success', 'message' => 'Environment file saved.']);
    }

    public function restore(
        Site $site,
        EnvSnapshot $snapshot,
        SiteEnvironmentService $environment,
    ): RedirectResponse {
        try {
            $environment->restore($site, request()->user(), $snapshot);
        } catch (RuntimeException $e) {
            return back()->withErrors(['environment' => $e->getMessage()]);
        }

        return back()->with('toast', ['type' => 'success', 'message' => 'Environment snapshot restored.']);
    }

    /**
     * @return array<string, mixed>
     */
    public static function snapshotPayload(EnvSnapshot $snapshot): array
    {
        return [
            'id' => $snapshot->id,
            'created_at' => $snapshot->created_at?->toIso8601String(),
            'contents' => $snapshot->contents,
        ];
    }
}
