<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Server;
use App\Services\Server\ServerMetricsService;
use Illuminate\Http\JsonResponse;

class ServerMetricsController extends Controller
{
    public function __invoke(ServerMetricsService $metrics): JsonResponse
    {
        return response()->json($metrics->current(Server::current()));
    }
}
