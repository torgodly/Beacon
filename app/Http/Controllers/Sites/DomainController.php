<?php

namespace App\Http\Controllers\Sites;

use App\Actions\Site\AttachDomain;
use App\Actions\Site\DetachDomain;
use App\Actions\Site\SetPrimaryDomain;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSiteDomainRequest;
use App\Models\Site;
use App\Models\SiteDomain;
use Illuminate\Http\RedirectResponse;
use RuntimeException;

class DomainController extends Controller
{
    public function store(
        StoreSiteDomainRequest $request,
        Site $site,
        AttachDomain $attachDomain,
    ): RedirectResponse {
        try {
            $attachDomain->handle(
                $site,
                $request->validated('domain'),
                (bool) $request->boolean('redirect_www'),
            );
        } catch (RuntimeException $e) {
            return back()->withErrors(['domain' => $e->getMessage()]);
        }

        return back()->with('toast', ['type' => 'success', 'message' => 'Domain added.']);
    }

    public function destroy(Site $site, SiteDomain $domain, DetachDomain $detachDomain): RedirectResponse
    {
        try {
            $detachDomain->handle($site, $domain);
        } catch (RuntimeException $e) {
            return back()->withErrors(['domain' => $e->getMessage()]);
        }

        return back()->with('toast', ['type' => 'success', 'message' => 'Domain removed.']);
    }

    public function makePrimary(
        Site $site,
        SiteDomain $domain,
        SetPrimaryDomain $setPrimaryDomain,
    ): RedirectResponse {
        abort_unless($domain->site_id === $site->id, 404);

        try {
            $setPrimaryDomain->handle($site, $domain);
        } catch (RuntimeException $e) {
            return back()->withErrors(['domain' => $e->getMessage()]);
        }

        return back()->with('toast', ['type' => 'success', 'message' => 'Primary domain updated.']);
    }
}
