<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\AttachPanelDomainRequest;
use App\Http\Requests\UpdateDeployPollingRequest;
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
            'deployPolling' => [
                'configured_interval_seconds' => $server->settings['deploy_poll_interval_seconds'] ?? null,
                'effective_interval_seconds' => $server->deployPollIntervalSeconds(),
                'default_interval_seconds' => (int) config('beacon.deployments.default_poll_interval_seconds', 60),
                'min_interval_seconds' => (int) config('beacon.deployments.min_poll_interval_seconds', 30),
                'max_interval_seconds' => (int) config('beacon.deployments.max_poll_interval_seconds', 3600),
            ],
        ]);
    }

    public function updateDeployPolling(UpdateDeployPollingRequest $request): RedirectResponse
    {
        $server = Server::current();
        $settings = $server->settings ?? [];
        $interval = $request->validated('deploy_poll_interval_seconds');

        if ($interval === null) {
            unset($settings['deploy_poll_interval_seconds']);
        } else {
            $settings['deploy_poll_interval_seconds'] = (int) $interval;
        }

        $server->update(['settings' => $settings === [] ? null : $settings]);

        return back()->with('toast', [
            'type' => 'success',
            'message' => 'Deploy polling interval saved.',
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
