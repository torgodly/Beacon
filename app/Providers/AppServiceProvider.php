<?php

namespace App\Providers;

use App\Services\System\ProcessFactory;
use App\Services\System\SymfonyProcessFactory;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Events\ConnectionEstablished;
use Illuminate\Database\SQLiteConnection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(ProcessFactory::class, SymfonyProcessFactory::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureSqlite();
        $this->configureRateLimiting();
    }

    protected function configureRateLimiting(): void
    {
        RateLimiter::for('deploy', function (Request $request) {
            return Limit::perMinute(10)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('console', function (Request $request) {
            return Limit::perMinute(30)->by($request->user()?->id ?: $request->ip());
        });
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Model::shouldBeStrict(! app()->isProduction());

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }

    /**
     * Beacon's own datastore is SQLite (WAL mode) so stopping a managed
     * MySQL server from the Services widget can never take the panel down
     * with it. These pragmas make that connection safe for concurrent
     * web + queue-worker access.
     */
    protected function configureSqlite(): void
    {
        // Applied when a connection is actually opened — never at boot.
        //
        // `DB::connection()` here resolved the default connection on EVERY
        // request, including ones that touch no database at all. Worse, it ran
        // inside BootProviders, so any database problem became a boot-time
        // fatal before the exception handler could render it. PHP then emitted
        // the error into the FastCGI stream, where nginx parsed it as response
        // headers and answered 502:
        //   upstream sent too big header while reading response header
        // A panel that cannot reach its database should show an error page,
        // not a bad gateway.
        Event::listen(function (ConnectionEstablished $event): void {
            if (! $event->connection instanceof SQLiteConnection) {
                return;
            }

            try {
                $event->connection->statement('PRAGMA journal_mode=WAL');
                $event->connection->statement('PRAGMA busy_timeout=5000');
                $event->connection->statement('PRAGMA foreign_keys=ON');
            } catch (Throwable) {
                // Best-effort tuning, never a reason to fail.
                //
                // A cache store backed by the database resolves a connection
                // while providers are still booting (RateLimiter::for below
                // pulls in the cache manager), so this listener can run inside
                // the boot phase after all. Letting a pragma throw there would
                // recreate exactly the boot-time fatal this method exists to
                // avoid. Swallowing is safe because the pragmas are tuning, not
                // correctness: if the connection is genuinely broken, the first
                // real query fails immediately with a far better message and
                // the normal error page.
            }
        });
    }
}
