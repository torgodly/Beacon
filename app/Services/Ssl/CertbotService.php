<?php

namespace App\Services\Ssl;

use App\Models\Site;
use App\Models\SslCertificate;
use App\Services\Nginx\NginxService;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use App\Support\SiteNginxSync;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use RuntimeException;

class CertbotService
{
    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly NginxService $nginx,
    ) {}

    public function issue(Site $site, string $email): SslCertificate
    {
        $domains = $site->domains()
            ->whereNull('redirect_to')
            ->pluck('domain')
            ->all();

        if ($domains === []) {
            throw new RuntimeException('Add at least one non-redirect domain before requesting a certificate.');
        }

        $primaryDomain = $site->domains->firstWhere('is_primary', true);
        $primary = $primaryDomain !== null ? $primaryDomain->domain : $site->name;
        $certName = $primary;

        $args = array_values(array_merge(['issue', $email], $domains, [$certName]));

        $result = $this->runner->sudoRoot(SudoWrapper::Certbot, $args, timeout: 600);

        if ($result->failed()) {
            throw new RuntimeException(trim($result->errorOutput()) ?: 'Certificate issuance failed.');
        }

        $certificate = $this->syncSiteCertificates($site)
            ->firstWhere('lineage', $certName);

        if ($certificate === null) {
            throw new RuntimeException('Certificate was issued but could not be read back from certbot.');
        }

        $site->update(['ssl_status' => 'issued']);
        SiteNginxSync::refresh($site, $this->nginx);
        $site->activity()->with(['lineage' => $certName])->log('ssl.issued');

        return $certificate;
    }

    public function deleteCertificate(SslCertificate $certificate): void
    {
        $lineage = $certificate->lineage;
        $site = $certificate->site;

        if ($site === null) {
            $certificate->delete();

            return;
        }

        $result = $this->runner->sudoRoot(
            SudoWrapper::Certbot,
            ['delete', $lineage],
        );

        if ($result->failed()) {
            throw new RuntimeException(trim($result->errorOutput()) ?: 'Could not delete certificate.');
        }

        $certificate->delete();

        if (! $site->sslCertificates()->where('status', 'issued')->exists()) {
            $site->update(['ssl_status' => 'none']);
        }

        SiteNginxSync::refresh($site, $this->nginx);
        $site->activity()->with(['lineage' => $lineage])->log('ssl.deleted');
    }

    public function deleteAllForSite(Site $site): void
    {
        foreach ($site->sslCertificates as $certificate) {
            $result = $this->runner->sudoRoot(
                SudoWrapper::Certbot,
                ['delete', $certificate->lineage],
            );

            if ($result->failed()) {
                throw new RuntimeException(trim($result->errorOutput()) ?: 'Could not delete certificate.');
            }
        }

        $site->sslCertificates()->delete();
        $site->update(['ssl_status' => 'none']);
    }

    /**
     * @return Collection<int, SslCertificate>
     */
    public function syncSiteCertificates(Site $site): Collection
    {
        $result = $this->runner->sudoRoot(SudoWrapper::Certbot, ['certificates']);

        if ($result->failed()) {
            throw new RuntimeException('Could not read certificates from certbot.');
        }

        $parsed = CertificateParser::parseCertbotCertificates($result->output());
        $synced = collect();
        $site->loadMissing('domains');
        $siteDomainNames = $site->domains->pluck('domain');

        foreach ($parsed as $row) {
            if (! $siteDomainNames->intersect($row['domains'])->isNotEmpty()) {
                continue;
            }

            $expiresAt = filled($row['expiry'])
                ? Carbon::parse($row['expiry'])
                : null;

            $certificate = SslCertificate::query()->updateOrCreate(
                [
                    'site_id' => $site->id,
                    'lineage' => $row['lineage'],
                ],
                [
                    'provider' => 'letsencrypt',
                    'domains' => $row['domains'],
                    'status' => 'issued',
                    'certificate_path' => $row['certificate_path'],
                    'private_key_path' => $row['private_key_path'],
                    'issued_at' => now(),
                    'expires_at' => $expiresAt,
                    'last_error' => null,
                ],
            );

            $synced->push($certificate);
        }

        if ($synced->contains(fn (SslCertificate $cert): bool => $cert->status === 'issued')) {
            $site->update(['ssl_status' => 'issued']);
        }

        return $synced;
    }

    public function renew(): void
    {
        $this->runner->sudoRoot(SudoWrapper::Certbot, ['renew'], timeout: 600);
        $this->nginx->reload();
    }
}
