<?php

use App\Http\Controllers\Settings\GitHubController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\SecurityController;
use App\Http\Controllers\Settings\ServerSettingsController;
use App\Http\Controllers\Settings\UpdatesController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/security', [SecurityController::class, 'edit'])
        ->middleware('password.confirm.recent')
        ->name('security.edit');

    Route::put('settings/password', [SecurityController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('user-password.update');

    Route::inertia('settings/appearance', 'settings/appearance')->name('appearance.edit');

    Route::get('settings/github', [GitHubController::class, 'edit'])->name('github.edit');
    Route::post('settings/github/deliveries/{delivery}/redeliver', [GitHubController::class, 'redeliver'])
        ->name('github.deliveries.redeliver');
    Route::get('settings/github/callback', [GitHubController::class, 'callback'])->name('github.callback');
    Route::get('settings/github/setup', [GitHubController::class, 'setup'])->name('github.setup');
    Route::delete('settings/github', [GitHubController::class, 'destroy'])->name('github.destroy');

    Route::get('settings/updates', [UpdatesController::class, 'edit'])->name('updates.edit');
    Route::post('settings/updates', [UpdatesController::class, 'store'])
        ->middleware('password.confirm.recent')
        ->name('updates.store');
    Route::post('settings/updates/rollback', [UpdatesController::class, 'rollback'])
        ->middleware('password.confirm.recent')
        ->name('updates.rollback');
    Route::get('settings/updates/{update:uuid}/log', [UpdatesController::class, 'log'])->name('updates.log');

    Route::get('settings/server', [ServerSettingsController::class, 'edit'])->name('server.edit');
    Route::patch('settings/server/deploy-polling', [ServerSettingsController::class, 'updateDeployPolling'])
        ->name('server.deploy-polling.update');
    Route::post('settings/server/domain', [ServerSettingsController::class, 'attachDomain'])
        ->middleware('password.confirm.recent')
        ->name('server.domain.attach');
});

Route::get('.well-known/passkey-endpoints', function () {
    return response()->json([
        'enroll' => route('security.edit'),
        'manage' => route('security.edit'),
    ]);
})->name('well-known.passkeys');
