<?php

use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\RequireRecentPassword;
use App\Jobs\PollRepositoryHeads;
use App\Jobs\PollServerMetrics;
use App\Jobs\SyncSslCertificates;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schedule;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withSchedule(function (): void {
        Schedule::job(new PollServerMetrics)->everyMinute();
        Schedule::job(new PollRepositoryHeads)->everyMinute();
        Schedule::job(new SyncSslCertificates)->daily();
        Schedule::command('beacon:prune')->daily();
        Schedule::command('beacon:backup')->weeklyOn(1, '03:00');
    })
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->validateCsrfTokens(except: [
            'webhooks/github',
        ]);

        // AddLinkHeadersForPreloadedAssets is deliberately NOT registered.
        //
        // It emits one `Link: <asset>; rel="preload"` entry per Vite chunk, in a
        // single header that grew to ~3 KB on the site detail page. nginx buffers
        // an upstream's whole header block in one allocation, so once the total
        // crossed the default 4 KB the panel answered 502 "upstream sent too big
        // header" — a hard failure that scales with the number of chunks a page
        // imports, so it would return as the UI grows. The vhosts now provision
        // 32 KB, but the header itself is redundant: Vite already emits
        // <link rel="modulepreload"> tags into the document head, and the header's
        // one unique consumer was HTTP/2 Server Push, which Chrome removed.
        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
        ]);

        $middleware->alias([
            'password.confirm.recent' => RequireRecentPassword::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
