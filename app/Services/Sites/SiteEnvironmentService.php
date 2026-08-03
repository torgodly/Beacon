<?php

namespace App\Services\Sites;

use App\Models\EnvSnapshot;
use App\Models\Site;
use App\Models\SupervisorProcess;
use App\Models\User;
use App\Services\Supervisor\SupervisorService;
use App\Services\System\SiteFilesystem;
use RuntimeException;

class SiteEnvironmentService
{
    public function __construct(
        private readonly SiteFilesystem $filesystem,
        private readonly SupervisorService $supervisor,
    ) {}

    public function read(Site $site): string
    {
        try {
            return $this->filesystem->read($site->envPath());
        } catch (RuntimeException) {
            return '';
        }
    }

    public function write(Site $site, User $user, string $contents): void
    {
        $existing = $this->read($site);

        if ($existing !== '') {
            EnvSnapshot::query()->create([
                'site_id' => $site->id,
                'user_id' => $user->id,
                'contents' => $existing,
            ]);
        }

        $this->filesystem->write($site->envPath(), $contents, 0640);

        $site->activity()->log('site.env_updated');

        $site->supervisorProcesses()->each(function (SupervisorProcess $process): void {
            try {
                $this->supervisor->restart($process);
            } catch (RuntimeException) {
                // Best-effort worker restart after env change.
            }
        });
    }

    public function restore(Site $site, User $user, EnvSnapshot $snapshot): void
    {
        abort_unless($snapshot->site_id === $site->id, 404);

        $this->write($site, $user, $snapshot->contents);
    }
}
