<?php

namespace App\Jobs;

use App\Models\Site;
use App\Services\Ssl\CertbotService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SyncSslCertificates implements ShouldQueue
{
    use Queueable;

    public function handle(CertbotService $certbot): void
    {
        Site::query()->each(function (Site $site) use ($certbot): void {
            try {
                $certbot->syncSiteCertificates($site);
            } catch (\Throwable) {
                // Certbot may be unavailable in dev — skip silently per site.
            }
        });
    }
}
