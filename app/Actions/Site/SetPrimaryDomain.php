<?php

namespace App\Actions\Site;

use App\Models\Site;
use App\Models\SiteDomain;
use App\Services\Nginx\NginxService;
use App\Support\SiteNginxSync;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class SetPrimaryDomain
{
    public function __construct(private readonly NginxService $nginx) {}

    public function handle(Site $site, SiteDomain $domain): void
    {
        if ($domain->site_id !== $site->id) {
            throw new RuntimeException('Domain does not belong to this site.');
        }

        if ($domain->redirect_to) {
            throw new RuntimeException('Redirect aliases cannot be set as the primary domain.');
        }

        DB::transaction(function () use ($site, $domain): void {
            $site->domains()->update(['is_primary' => false]);
            $domain->update(['is_primary' => true]);

            SiteNginxSync::refresh($site, $this->nginx);
            $site->activity()->with(['domain' => $domain->domain])->log('domain.primary_changed');
        });
    }
}
