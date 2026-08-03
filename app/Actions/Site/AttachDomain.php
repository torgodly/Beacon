<?php

namespace App\Actions\Site;

use App\Models\Site;
use App\Models\SiteDomain;
use App\Services\Nginx\NginxService;
use App\Support\SiteNginxSync;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class AttachDomain
{
    public function __construct(private readonly NginxService $nginx) {}

    public function handle(Site $site, string $domain, bool $redirectWww = false): SiteDomain
    {
        if (SiteDomain::query()->where('domain', $domain)->exists()) {
            throw new RuntimeException("Domain {$domain} is already in use.");
        }

        return DB::transaction(function () use ($site, $domain, $redirectWww): SiteDomain {
            $attached = SiteDomain::query()->create([
                'site_id' => $site->id,
                'domain' => $domain,
                'is_primary' => false,
            ]);

            if ($redirectWww && ! str_starts_with($domain, 'www.')) {
                $www = 'www.'.$domain;

                if (! SiteDomain::query()->where('domain', $www)->exists()) {
                    SiteDomain::query()->create([
                        'site_id' => $site->id,
                        'domain' => $www,
                        'is_primary' => false,
                        'redirect_to' => $domain,
                        'redirect_status_code' => 301,
                    ]);
                }
            }

            SiteNginxSync::refresh($site, $this->nginx);
            $site->activity()->with(['domain' => $domain])->log('domain.attached');

            return $attached;
        });
    }
}
