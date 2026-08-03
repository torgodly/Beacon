<?php

namespace App\Http\Middleware;

use App\Services\Server\HealthCheckService;
use App\Support\CommandPaletteData;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $health = $request->user()
            ? Cache::remember('beacon:health', 30, fn (): array => app(HealthCheckService::class)->check())
            : ['healthy' => true, 'issues' => []];

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'flash' => [
                'database_user_password' => fn () => $request->session()->get('database_user_password'),
            ],
            'beacon' => [
                'health' => $health,
            ],
            'commandPalette' => fn () => $request->user()
                ? app(CommandPaletteData::class)->build()
                : null,
        ];
    }
}
