<?php

namespace App\Http\Controllers\Sites;

use App\Actions\Site\UpdateSiteRuntime;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateSiteRuntimeRequest;
use App\Models\Site;
use Illuminate\Http\RedirectResponse;
use RuntimeException;

class SiteRuntimeController extends Controller
{
    public function update(
        UpdateSiteRuntimeRequest $request,
        Site $site,
        UpdateSiteRuntime $updateSiteRuntime,
    ): RedirectResponse {
        try {
            $updateSiteRuntime->handle($site, $request->runtimeData());
        } catch (RuntimeException $e) {
            return back()->withErrors(['runtime' => $e->getMessage()]);
        }

        return back()->with('toast', [
            'type' => 'success',
            'message' => 'Runtime versions updated.',
        ]);
    }
}
