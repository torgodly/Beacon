<?php

namespace App\Support;

use App\Models\Site;
use App\Services\Nginx\NginxService;

class SiteNginxSync
{
    public static function refresh(Site $site, NginxService $nginx): void
    {
        $site->refresh();

        if ($site->nginx_customized) {
            return;
        }

        $nginx->generateAndApply($site->fresh(['domains', 'sslCertificates']));
    }
}
