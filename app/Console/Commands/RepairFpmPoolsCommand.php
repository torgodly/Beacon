<?php

namespace App\Console\Commands;

use App\Models\Site;
use App\Services\Php\PhpPoolWriter;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('beacon:repair-fpm-pools')]
#[Description('Regenerate site PHP-FPM pools and fix missing system_user values')]
class RepairFpmPoolsCommand extends Command
{
    public function handle(PhpPoolWriter $pools): int
    {
        $regenerated = 0;

        Site::query()
            ->whereNotNull('php_version')
            ->orderBy('name')
            ->each(function (Site $site) use ($pools, &$regenerated): void {
                if (blank($site->system_user)) {
                    $site->update([
                        'system_user' => (string) config('beacon.site_user', 'beacon'),
                    ]);
                    $site->refresh();
                }

                $pools->write($site);
                $regenerated++;
                $this->components->info("Regenerated pool for {$site->name}");
            });

        if ($regenerated === 0) {
            $this->components->info('No PHP sites found — nothing to repair.');
        }

        return self::SUCCESS;
    }
}
