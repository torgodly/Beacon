<?php

namespace App\Http\Controllers\Services;

use App\Http\Controllers\Controller;
use App\Services\Server\ServiceControlService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class ServiceController extends Controller
{
    public function index(ServiceControlService $services): Response
    {
        return Inertia::render('services/index', [
            'services' => $services->list(),
        ]);
    }

    public function restart(string $unit, ServiceControlService $services): RedirectResponse
    {
        try {
            $services->restart($unit);
        } catch (RuntimeException $e) {
            return back()->with('toast', [
                'type' => 'error',
                'message' => $e->getMessage(),
            ]);
        }

        return back()->with('toast', [
            'type' => 'success',
            'message' => "{$unit} restarted successfully.",
        ]);
    }
}
