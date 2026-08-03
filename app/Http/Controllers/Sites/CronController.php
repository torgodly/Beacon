<?php

namespace App\Http\Controllers\Sites;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCronJobRequest;
use App\Models\CronJob;
use App\Models\Site;
use App\Services\Cron\CronService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use RuntimeException;

class CronController extends Controller
{
    public function store(StoreCronJobRequest $request, Site $site, CronService $cron): RedirectResponse
    {
        try {
            $cron->createJob($site, $request->validated());
        } catch (RuntimeException $e) {
            return back()->withErrors(['cron' => $e->getMessage()]);
        }

        $site->activity()->log('cron.created');

        return back()->with('toast', ['type' => 'success', 'message' => 'Cron job added.']);
    }

    public function toggleScheduler(Request $request, Site $site, CronService $cron): RedirectResponse
    {
        $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        $enabled = (bool) $request->boolean('enabled');

        try {
            $cron->ensureLaravelScheduler($site, $enabled);
        } catch (RuntimeException $e) {
            return back()->withErrors(['cron' => $e->getMessage()]);
        }

        return back()->with('toast', [
            'type' => 'success',
            'message' => $enabled ? 'Laravel scheduler enabled.' : 'Laravel scheduler disabled.',
        ]);
    }

    public function destroy(Site $site, CronJob $cronJob, CronService $cron): RedirectResponse
    {
        abort_unless($cronJob->site_id === $site->id, 404);
        abort_if($cronJob->is_laravel_scheduler, 422, 'Use the scheduler toggle for the Laravel scheduler job.');

        try {
            $cron->deleteJob($cronJob);
        } catch (RuntimeException $e) {
            return back()->withErrors(['cron' => $e->getMessage()]);
        }

        return back()->with('toast', ['type' => 'success', 'message' => 'Cron job removed.']);
    }

    /**
     * @return array<string, mixed>
     */
    public static function jobPayload(CronJob $job): array
    {
        return [
            'id' => $job->id,
            'name' => $job->name,
            'command' => $job->command,
            'expression' => $job->expression,
            'frequency_preset' => $job->frequency_preset,
            'is_laravel_scheduler' => $job->is_laravel_scheduler,
            'enabled' => $job->enabled,
        ];
    }
}
