<?php

namespace App\Http\Controllers;

use App\Models\Server;
use App\Services\Php\PhpService;
use App\Services\Server\ServerMetricsService;
use App\Services\Server\ServiceControlService;
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

        return Inertia::render('dashboard', [
            'metrics' => $metrics->current($server),
            'sparkline' => $metrics->sparkline($server),
            'services' => $services->list(),
            'phpVersions' => $php->list($server),
        ]);
    }
}
