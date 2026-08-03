<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\AttachPanelDomainRequest;
use App\Models\Server;
use App\Services\Server\PanelDomainService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class ServerSettingsController extends Controller
{
    public function edit(): Response
    {
        $server = Server::current();

        return Inertia::render('settings/server', [
            'panel' => [
                'domain' => $server->panel_domain,
                'port' => $server->panel_port,
                'url_public' => $server->panel_url_public,
                'app_url' => config('app.url'),
                'can_attach_domain' => ! $server->panel_url_public
                    || $server->panel_port !== 443
                    || blank($server->panel_domain)
                    || filter_var($server->panel_domain, FILTER_VALIDATE_IP) !== false,
            ],
        ]);
    }

    public function attachDomain(
        AttachPanelDomainRequest $request,
        PanelDomainService $panelDomain,
    ): RedirectResponse {
        try {
            $panelDomain->attach(
                Server::current(),
                $request->validated('domain'),
                $request->validated('email'),
            );
        } catch (RuntimeException $e) {
            return back()->withErrors(['domain' => $e->getMessage()]);
        }

        return back()->with('toast', [
            'type' => 'success',
            'message' => 'Panel domain attached. HTTPS is now served on port 443.',
        ]);
    }
}
