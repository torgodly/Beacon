<?php

namespace App\Http\Controllers\Sites;

use App\Actions\Site\CreateSite;
use App\Actions\Site\DeleteSite;
use App\Actions\Site\UpdateSiteServing;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSiteRequest;
use App\Http\Requests\UpdateSiteIsolationRequest;
use App\Http\Requests\UpdateSiteNginxRequest;
use App\Http\Requests\UpdateSiteServingRequest;
use App\Models\CronJob;
use App\Models\Deployment;
use App\Models\EnvSnapshot;
use App\Models\GithubInstallation;
use App\Models\NodeVersion;
use App\Models\PhpVersion;
use App\Models\Server;
use App\Models\Site;
use App\Models\SiteCommand;
use App\Models\SiteDomain;
use App\Models\SslCertificate;
use App\Models\SupervisorProcess;
use App\Services\Deployment\DeploymentService;
use App\Services\Nginx\NginxService;
use App\Services\Php\PhpPoolWriter;
use App\Services\Sites\SiteEnvironmentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class SiteController extends Controller
{
    public function index(): Response
    {
        $sites = Site::query()
            ->with('domains')
            ->orderBy('name')
            ->get()
            ->map(fn (Site $site): array => $this->siteSummary($site));

        $server = Server::current();

        // Only versions actually present on the host may be selected. Offering
        // every *supported* version let an operator create a site pinned to a
        // PHP-FPM pool that does not exist.
        $installedPhp = PhpVersion::query()
            ->where('server_id', $server->id)
            ->where('status', 'installed')
            ->orderByDesc('version')
            ->get()
            ->map(fn (PhpVersion $php): array => [
                'value' => $php->version,
                'label' => "PHP {$php->version}",
                'is_default' => (bool) $php->is_default,
            ])
            ->values();

        $installedNode = NodeVersion::query()
            ->where('server_id', $server->id)
            ->where('runtime', 'node')
            ->orderByDesc('version')
            ->get()
            ->map(fn (NodeVersion $node): array => [
                'value' => $node->version,
                'label' => "Node {$node->version}",
                'is_default' => (bool) $node->is_default,
            ])
            ->values();

        return Inertia::render('sites/index', [
            'sites' => $sites,
            // Each type declares which runtime it actually needs, so the form
            // can hide fields rather than asking for a PHP version on a static
            // site and then ignoring the answer.
            'siteTypes' => [
                [
                    'value' => 'laravel',
                    'label' => 'Laravel',
                    'description' => 'PHP-FPM, Composer, queues and the scheduler.',
                    'runtime' => 'php',
                    'web_directory' => '/public',
                ],
                [
                    'value' => 'nextjs',
                    'label' => 'Next.js',
                    'description' => 'SSR behind an Nginx reverse proxy, managed by Supervisor.',
                    'runtime' => 'node',
                    'web_directory' => null,
                ],
                [
                    'value' => 'nuxt',
                    'label' => 'Nuxt',
                    'description' => 'Nitro server behind an Nginx reverse proxy.',
                    'runtime' => 'node',
                    'web_directory' => null,
                ],
                [
                    'value' => 'static',
                    'label' => 'Static',
                    'description' => 'React, Vue, Astro or plain HTML served straight from disk.',
                    'runtime' => 'none',
                    'web_directory' => '/',
                ],
            ],
            'phpVersions' => $installedPhp,
            'nodeVersions' => $installedNode,
            'packageManager' => $server->default_package_manager,
        ]);
    }

    public function store(StoreSiteRequest $request, CreateSite $createSite): RedirectResponse
    {
        try {
            $site = $createSite->handle($request->siteData());
        } catch (RuntimeException $e) {
            return back()->withErrors(['name' => $e->getMessage()]);
        }

        $query = filled($site->repository)
            ? ['tab' => 'overview']
            : [];

        return redirect()
            ->to(route('sites.show', $site).($query !== [] ? '?'.http_build_query($query) : ''))
            ->with('toast', [
                'type' => 'success',
                'message' => filled($site->repository)
                    ? "Site {$site->name} created with repository connected. Deploy when ready."
                    : "Site {$site->name} created.",
            ]);
    }

    public function show(Request $request, Site $site, NginxService $nginx): Response
    {
        $site->load(['domains', 'sslCertificates']);

        $tab = $request->query('tab', 'overview');

        $deployments = null;
        $deployScript = null;
        $activeDeployment = null;
        $latestDeployment = null;
        $sslCertificate = null;
        $siteSettings = null;
        $runtimeOptions = null;
        $deployEnvReference = null;
        $supervisorProcesses = null;
        $cronJobs = null;
        $environment = null;
        $consoleCommands = null;
        $activeCommand = null;

        if ($tab === 'deployments') {
            $deployments = $site->deployments()
                ->latest()
                ->limit(20)
                ->get()
                ->map(fn (Deployment $deployment): array => DeploymentController::deploymentPayload($deployment));

            $deployScript = $site->deploy_script;
            $deployEnvReference = DeploymentService::deployEnvironmentReference();
        }

        if ($request->filled('deployment')) {
            $selected = $site->deployments()
                ->where('uuid', $request->query('deployment'))
                ->first();

            if ($selected !== null) {
                $activeDeployment = DeploymentController::deploymentPayload($selected);
            }
        } elseif ($activeDeployment === null) {
            $inFlight = $site->deployments()
                ->whereIn('status', ['queued', 'running'])
                ->latest()
                ->first();

            if ($inFlight !== null) {
                $activeDeployment = DeploymentController::deploymentPayload($inFlight);
            }
        }

        $latest = $site->deployments()->latest()->first();
        if ($latest !== null) {
            $latestDeployment = DeploymentController::deploymentPayload($latest);
        }

        if ($tab === 'ssl') {
            $issued = $site->sslCertificates->first(
                fn (SslCertificate $certificate): bool => $certificate->status === 'issued',
            );
            $sslCertificate = SslController::certificatePayload($issued);
        }

        if ($tab === 'settings') {
            $installation = GithubInstallation::query()
                ->where('user_id', $request->user()->id)
                ->whereNotNull('installation_id')
                ->first();

            $siteSettings = [
                'repository' => $site->repository,
                'repository_branch' => $site->repository_branch ?? 'main',
                'repository_provider' => $site->repository_provider ?? 'custom',
                'auto_deploy' => $site->auto_deploy,
                'deploy_trigger' => $site->deploy_trigger,
                'deploy_key_public' => $site->deploy_key_public,
                'github' => [
                    'connected' => $installation !== null,
                    'account_login' => $installation?->account_login,
                    'selected_repo_id' => $site->github_repo_id,
                    'selected_repository' => $site->repository_provider === 'github'
                        ? $site->repository
                        : null,
                ],
            ];

            $server = Server::current();

            $runtimeOptions = [
                'php_versions' => PhpVersion::query()
                    ->where('server_id', $server->id)
                    ->where('status', 'installed')
                    ->orderBy('version')
                    ->pluck('version')
                    ->values()
                    ->all(),
                'node_versions' => NodeVersion::query()
                    ->where('server_id', $server->id)
                    ->where('runtime', 'node')
                    ->where('status', 'installed')
                    ->orderBy('version')
                    ->pluck('version')
                    ->values()
                    ->all(),
            ];
        }

        if ($tab === 'supervisor') {
            $supervisorProcesses = $site->supervisorProcesses()
                ->orderBy('name')
                ->get()
                ->map(fn (SupervisorProcess $process): array => SupervisorController::processPayload($process));
        }

        if ($tab === 'cron') {
            $cronJobs = $site->cronJobs()
                ->orderBy('name')
                ->get()
                ->map(fn (CronJob $job): array => CronController::jobPayload($job));
        }

        if ($tab === 'environment') {
            $environment = [
                'contents' => app(SiteEnvironmentService::class)->read($site),
                'snapshots' => $site->envSnapshots()
                    ->latest('id')
                    ->limit(10)
                    ->get()
                    ->map(fn (EnvSnapshot $snapshot): array => EnvironmentController::snapshotPayload($snapshot)),
            ];
        }

        if ($tab === 'console') {
            $consoleCommands = $site->commands()
                ->latest('id')
                ->limit(20)
                ->get()
                ->map(fn (SiteCommand $command): array => ConsoleController::commandPayload($command));

            if ($request->filled('command')) {
                $selected = $site->commands()
                    ->where('uuid', $request->query('command'))
                    ->first();

                if ($selected !== null) {
                    $activeCommand = ConsoleController::commandPayload($selected);
                }
            }
        }

        return Inertia::render('sites/show', [
            'site' => $this->siteDetail($site),
            'tab' => $tab,
            'nginx' => $tab === 'nginx' ? [
                'contents' => $nginx->read($site),
                'generated' => $nginx->previewGenerated($site),
                'customized' => $site->nginx_customized,
            ] : null,
            'deployments' => $deployments,
            'deployScript' => $deployScript,
            'activeDeployment' => $activeDeployment,
            'latestDeployment' => $latestDeployment,
            'sslCertificate' => $sslCertificate,
            'siteSettings' => $siteSettings,
            'runtimeOptions' => $runtimeOptions,
            'deployEnvReference' => $deployEnvReference,
            'supervisorProcesses' => $supervisorProcesses,
            'cronJobs' => $cronJobs,
            'environment' => $environment,
            'consoleCommands' => $consoleCommands,
            'activeCommand' => $activeCommand,
        ]);
    }

    public function updateNginx(UpdateSiteNginxRequest $request, Site $site, NginxService $nginx): RedirectResponse
    {
        try {
            $nginx->saveRaw($site, $request->validated('contents'));
        } catch (ValidationException $e) {
            throw $e;
        }

        return back()->with('toast', ['type' => 'success', 'message' => 'Nginx configuration saved.']);
    }

    public function resetNginx(Site $site, NginxService $nginx): RedirectResponse
    {
        $nginx->resetToGenerated($site);

        return back()->with('toast', ['type' => 'success', 'message' => 'Nginx configuration reset to generated template.']);
    }

    public function updateIsolation(UpdateSiteIsolationRequest $request, Site $site, PhpPoolWriter $pools): RedirectResponse
    {
        $site->update($request->validated());
        $pools->write($site->fresh());
        $site->activity()->log('site.isolation_updated');

        return back()->with('toast', ['type' => 'success', 'message' => 'Isolation settings updated.']);
    }

    /**
     * Document root, SPA fallback and upload ceiling.
     *
     * The document root has to exist before nginx is pointed at it, otherwise
     * the site answers 404 against a missing directory — so it is created (and
     * made readable by www-data) as part of the change.
     */
    public function updateServing(
        UpdateSiteServingRequest $request,
        Site $site,
        UpdateSiteServing $updateServing,
    ): RedirectResponse {
        try {
            $updateServing->handle($site, $request->validated());
        } catch (RuntimeException $e) {
            return back()->withErrors(['web_directory' => $e->getMessage()]);
        }

        return back()->with('toast', [
            'type' => 'success',
            'message' => 'Serving settings updated.',
        ]);
    }

    public function destroy(Request $request, Site $site, DeleteSite $deleteSite): RedirectResponse
    {
        $request->validate([
            'confirmation' => ['required', 'string'],
        ]);

        try {
            $deleteSite->handle($site, $request->input('confirmation'));
        } catch (RuntimeException $e) {
            return back()->withErrors(['confirmation' => $e->getMessage()]);
        }

        return redirect()
            ->route('sites.index')
            ->with('toast', ['type' => 'success', 'message' => "Site {$site->name} deleted."]);
    }

    /**
     * @return array<string, mixed>
     */
    private function siteSummary(Site $site): array
    {
        return [
            'id' => $site->name,
            'name' => $site->name,
            'type' => $site->type,
            'status' => $site->status,
            'ssl_status' => $site->ssl_status,
            'deployment_status' => $site->deployment_status,
            'repository' => $site->repository,
            'repository_branch' => $site->repository_branch ?? 'main',
            'repository_connected' => filled($site->repository),
            'primary_domain' => ($primary = $site->domains->firstWhere('is_primary', true)) !== null
                ? $primary->domain
                : $site->name,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function siteDetail(Site $site): array
    {
        return [
            ...$this->siteSummary($site),
            'path' => $site->path,
            'web_directory' => $site->web_directory,
            'spa_fallback' => (bool) $site->spa_fallback,
            'client_max_body_size' => $site->client_max_body_size,
            'package_manager' => $site->package_manager,
            'php_version' => $site->php_version,
            'node_version' => $site->node_version,
            'proxy_port' => $site->proxy_port,
            // SSR types are reverse-proxied and have no document root, so the
            // serving panel hides those controls rather than offering settings
            // that would be ignored.
            'serves_from_disk' => in_array($site->type, ['laravel', 'static'], true),
            'nginx_customized' => $site->nginx_customized,
            'open_basedir' => $site->open_basedir,
            'strict_functions' => $site->strict_functions,
            'open_basedir_extra_paths' => $site->open_basedir_extra_paths ?? [],
            'domains' => $site->domains->map(fn (SiteDomain $domain): array => [
                'id' => $domain->id,
                'domain' => $domain->domain,
                'is_primary' => $domain->is_primary,
                'redirect_to' => $domain->redirect_to,
                'redirect_status_code' => $domain->redirect_status_code,
            ])->values()->all(),
            'ssl_status' => $site->ssl_status,
            'deployment_status' => $site->deployment_status,
            'repository' => $site->repository,
            'repository_branch' => $site->repository_branch ?? 'main',
            'repository_connected' => filled($site->repository),
        ];
    }
}
