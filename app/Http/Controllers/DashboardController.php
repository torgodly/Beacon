<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\CronJob;
use App\Models\Database;
use App\Models\Server;
use App\Models\Site;
use App\Models\SupervisorProcess;
use App\Services\Php\PhpService;
use App\Services\Server\ServerMetricsService;
use App\Services\Server\ServiceControlService;
use App\Support\ActivityEventLabel;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(
        ServerMetricsService $metrics,
        ServiceControlService $services,
        PhpService $php,
    ): Response {
        $server = Server::current();

        $sites = Site::query()
            ->orderBy('name')
            ->get()
            ->map(fn (Site $site): array => [
                'id' => $site->name,
                'name' => $site->name,
                'type' => $site->type,
                'status' => $site->status,
                'php_version' => $site->php_version,
                'node_version' => $site->node_version,
                'repository' => $site->repository,
                'repository_branch' => $site->repository_branch ?? 'main',
                'repository_connected' => filled($site->repository),
                'deployment_status' => $site->deployment_status,
                'last_deployed_at' => $site->last_deployed_at?->toIso8601String(),
            ])
            ->values()
            ->all();

        $databases = Database::query()
            ->where('server_id', $server->id)
            ->orderBy('name')
            ->get(['id', 'name', 'status'])
            ->map(fn (Database $database): array => [
                'id' => $database->id,
                'name' => $database->name,
                'status' => $database->status,
            ])
            ->values()
            ->all();

        $processes = SupervisorProcess::query()
            ->with('site:id,name')
            ->orderBy('name')
            ->get()
            ->map(fn (SupervisorProcess $process): array => [
                'id' => $process->id,
                'name' => $process->name,
                'command' => $process->command,
                'status' => $process->status,
                'site_name' => $process->site?->name,
            ])
            ->values()
            ->all();

        $cronJobs = CronJob::query()
            ->where('server_id', $server->id)
            ->with('site:id,name')
            ->orderBy('name')
            ->get()
            ->map(fn (CronJob $job): array => [
                'id' => $job->id,
                'name' => $job->name,
                'command' => $job->command,
                'frequency' => $job->frequency_preset ?? $job->expression,
                'enabled' => $job->enabled,
                'site_name' => $job->site?->name,
            ])
            ->values()
            ->all();

        $activity = ActivityLog::query()
            ->with('user:id,name')
            ->latest('id')
            ->limit(15)
            ->get()
            ->map(function (ActivityLog $log): array {
                $meta = ActivityEventLabel::for($log->event);

                return [
                    'id' => $log->id,
                    'label' => $meta['label'],
                    'description' => $log->description,
                    'subject_id' => $log->subject_id,
                    'created_at' => $log->created_at?->toIso8601String(),
                    'user_name' => $log->user?->name ?? 'Beacon',
                ];
            })
            ->values()
            ->all();

        return Inertia::render('dashboard', [
            'metrics' => $metrics->current($server),
            'sparkline' => $metrics->sparkline($server),
            'services' => $services->list(),
            'phpVersions' => $php->list($server),
            'server' => [
                'id' => $server->id,
                'hostname' => $server->hostname,
                'public_ip' => $server->public_ip,
                'site_user' => config('beacon.site_user'),
                'created_at' => $server->created_at?->toIso8601String(),
            ],
            'overview' => [
                'sites' => $sites,
                'databases' => $databases,
                'processes' => $processes,
                'cronJobs' => $cronJobs,
                'activity' => $activity,
            ],
        ]);
    }
}
