<?php

namespace App\Providers;

use App\Services\System\ProcessFactory;
use App\Services\System\SymfonyProcessFactory;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\SQLiteConnection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

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
        if (DB::connection() instanceof SQLiteConnection) {
            DB::statement('PRAGMA journal_mode=WAL');
            DB::statement('PRAGMA busy_timeout=5000');
            DB::statement('PRAGMA foreign_keys=ON');
        }
    }
}
