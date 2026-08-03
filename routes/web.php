<?php

use App\Http\Controllers\ActivityController;
use App\Http\Controllers\Api\ServerMetricsController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Databases\DatabaseBackupController;
use App\Http\Controllers\Databases\DatabaseController;
use App\Http\Controllers\OperationController;
use App\Http\Controllers\Php\PhpController;
use App\Http\Controllers\Runtime\RuntimeController;
use App\Http\Controllers\Services\ServiceController;
use App\Http\Controllers\Sites\ConsoleController;
use App\Http\Controllers\Sites\CronController;
use App\Http\Controllers\Sites\DeploymentController;
use App\Http\Controllers\Sites\DomainController;
use App\Http\Controllers\Sites\EnvironmentController;
use App\Http\Controllers\Sites\SiteController;
use App\Http\Controllers\Sites\SiteGitHubController;
use App\Http\Controllers\Sites\SiteRuntimeController;
use App\Http\Controllers\Sites\SiteSettingsController;
use App\Http\Controllers\Sites\SslController;
use App\Http\Controllers\Sites\SupervisorController;
use App\Http\Controllers\Webhooks\GitHubWebhookController;
use App\Http\Middleware\VerifyGitHubSignature;
use Illuminate\Auth\Middleware\RequirePassword;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::post('webhooks/github', GitHubWebhookController::class)
    ->middleware(VerifyGitHubSignature::class)
    ->name('webhooks.github');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::get('api/server/metrics', ServerMetricsController::class)->name('api.server.metrics');

    // Global operations dock — polled from every page, so these stay JSON.
    Route::get('api/operations', [OperationController::class, 'index'])->name('api.operations.index');
    Route::get('api/operations/{operation}/log', [OperationController::class, 'log'])->name('api.operations.log');

    Route::get('sites', [SiteController::class, 'index'])->name('sites.index');
    Route::post('sites', [SiteController::class, 'store'])->name('sites.store');
    Route::get('sites/{site:name}', [SiteController::class, 'show'])->name('sites.show');
    Route::patch('sites/{site:name}/nginx', [SiteController::class, 'updateNginx'])
        ->middleware(RequirePassword::class)
        ->name('sites.nginx.update');
    Route::post('sites/{site:name}/nginx/reset', [SiteController::class, 'resetNginx'])
        ->middleware(RequirePassword::class)
        ->name('sites.nginx.reset');
    Route::patch('sites/{site:name}/isolation', [SiteController::class, 'updateIsolation'])->name('sites.isolation.update');
    Route::patch('sites/{site:name}/serving', [SiteController::class, 'updateServing'])->name('sites.serving.update');
    Route::post('sites/{site:name}/deployments', [DeploymentController::class, 'store'])
        ->middleware('throttle:deploy')
        ->name('sites.deployments.store');
    Route::get('sites/{site:name}/deployments/{deployment:uuid}/log', [DeploymentController::class, 'log'])->name('sites.deployments.log');
    Route::patch('sites/{site:name}/deploy-script', [DeploymentController::class, 'updateScript'])->name('sites.deploy-script.update');
    Route::post('sites/{site:name}/domains', [DomainController::class, 'store'])->name('sites.domains.store');
    Route::delete('sites/{site:name}/domains/{domain}', [DomainController::class, 'destroy'])->name('sites.domains.destroy');
    Route::patch('sites/{site:name}/domains/{domain}/primary', [DomainController::class, 'makePrimary'])->name('sites.domains.primary');
    Route::post('sites/{site:name}/ssl/issue', [SslController::class, 'issue'])->name('sites.ssl.issue');
    Route::delete('sites/{site:name}/ssl/{certificate}', [SslController::class, 'destroy'])->name('sites.ssl.destroy');
    Route::patch('sites/{site:name}/settings', [SiteSettingsController::class, 'update'])->name('sites.settings.update');
    Route::patch('sites/{site:name}/runtime', [SiteRuntimeController::class, 'update'])->name('sites.runtime.update');
    Route::post('sites/{site:name}/deploy-key', [SiteSettingsController::class, 'generateDeployKey'])->name('sites.deploy-key.store');
    Route::get('sites/{site:name}/github/repositories', [SiteGitHubController::class, 'repositories'])->name('sites.github.repositories');
    Route::get('sites/{site:name}/github/repositories/{owner}/{repo}/branches', [SiteGitHubController::class, 'branches'])->name('sites.github.branches');
    Route::post('sites/{site:name}/supervisor', [SupervisorController::class, 'store'])->name('sites.supervisor.store');
    Route::post('sites/{site:name}/supervisor/{process}/restart', [SupervisorController::class, 'restart'])->name('sites.supervisor.restart');
    Route::delete('sites/{site:name}/supervisor/{process}', [SupervisorController::class, 'destroy'])->name('sites.supervisor.destroy');
    Route::post('sites/{site:name}/cron', [CronController::class, 'store'])->name('sites.cron.store');
    Route::post('sites/{site:name}/cron/scheduler', [CronController::class, 'toggleScheduler'])->name('sites.cron.scheduler');
    Route::delete('sites/{site:name}/cron/{cronJob}', [CronController::class, 'destroy'])->name('sites.cron.destroy');
    Route::patch('sites/{site:name}/environment', [EnvironmentController::class, 'update'])
        ->middleware(RequirePassword::class)
        ->name('sites.environment.update');
    Route::post('sites/{site:name}/environment/snapshots/{snapshot}/restore', [EnvironmentController::class, 'restore'])
        ->middleware(RequirePassword::class)
        ->name('sites.environment.restore');
    Route::post('sites/{site:name}/commands', [ConsoleController::class, 'store'])
        ->middleware([RequirePassword::class, 'throttle:console'])
        ->name('sites.commands.store');
    Route::get('sites/{site:name}/commands/{command:uuid}/log', [ConsoleController::class, 'log'])->name('sites.commands.log');
    Route::delete('sites/{site:name}', [SiteController::class, 'destroy'])->name('sites.destroy');

    Route::get('databases', [DatabaseController::class, 'index'])->name('databases.index');
    Route::post('databases', [DatabaseController::class, 'store'])->name('databases.store');
    Route::delete('databases/{database}', [DatabaseController::class, 'destroy'])->name('databases.destroy');
    Route::post('databases/{database}/backups', [DatabaseBackupController::class, 'store'])->name('databases.backups.store');
    Route::get('database-backups/{backup:uuid}/download', [DatabaseBackupController::class, 'download'])
        ->name('database-backups.download');
    Route::post('database-users', [DatabaseController::class, 'storeUser'])->name('database-users.store');
    Route::get('php', [PhpController::class, 'index'])->name('php.index');
    Route::post('php/{version}/install', [PhpController::class, 'install'])->name('php.install');
    Route::delete('php/{phpVersion}', [PhpController::class, 'destroy'])->name('php.destroy');
    Route::patch('php/{phpVersion}/default', [PhpController::class, 'setDefault'])->name('php.default');
    Route::post('php/{phpVersion}/extensions/{extension}/enable', [PhpController::class, 'enableExtension'])->name('php.extensions.enable');
    Route::post('php/{phpVersion}/extensions/{extension}/disable', [PhpController::class, 'disableExtension'])->name('php.extensions.disable');
    Route::patch('php/{phpVersion}/ini', [PhpController::class, 'updateIni'])->name('php.ini.update');
    Route::get('runtimes', [RuntimeController::class, 'index'])->name('runtimes.index');
    Route::patch('runtimes/{nodeVersion}/default', [RuntimeController::class, 'setDefault'])->name('runtimes.default');
    Route::patch('runtimes/package-manager', [RuntimeController::class, 'updatePackageManager'])->name('runtimes.package-manager');
    Route::get('services', [ServiceController::class, 'index'])->name('services.index');
    Route::post('services/{unit}/restart', [ServiceController::class, 'restart'])->name('services.restart');
    Route::get('activity', [ActivityController::class, 'index'])->name('activity.index');
});

require __DIR__.'/settings.php';
