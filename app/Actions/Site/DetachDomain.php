<?php

namespace App\Actions\Site;

use App\Models\Site;
use App\Models\SiteDomain;
use App\Services\Nginx\NginxService;
use App\Support\SiteNginxSync;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DetachDomain
{
    public function __construct(private readonly NginxService $nginx) {}

    public function handle(Site $site, SiteDomain $domain): void
    {
        if ($domain->site_id !== $site->id) {
            throw new RuntimeException('Domain does not belong to this site.');
        }

        if ($domain->is_primary) {
            throw new RuntimeException('Cannot remove the primary domain. Set another domain as primary first.');
        }

        if ($site->domains()->count() <= 1) {
            throw new RuntimeException('A site must keep at least one domain.');
        }

        DB::transaction(function () use ($site, $domain): void {
            $name = $domain->domain;
            $domain->delete();

            SiteNginxSync::refresh($site, $this->nginx);
            $site->activity()->with(['domain' => $name])->log('domain.detached');
        });
    }
}
