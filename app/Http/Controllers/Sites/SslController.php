<?php

namespace App\Http\Controllers\Sites;

use App\Http\Controllers\Controller;
use App\Http\Requests\IssueSslCertificateRequest;
use App\Models\Site;
use App\Models\SslCertificate;
use App\Services\Ssl\CertbotService;
use Illuminate\Http\RedirectResponse;
use RuntimeException;

class SslController extends Controller
{
    public function issue(
        IssueSslCertificateRequest $request,
        Site $site,
        CertbotService $certbot,
    ): RedirectResponse {
        try {
            $certbot->issue($site, $request->validated('email'));
        } catch (RuntimeException $e) {
            return back()->withErrors(['email' => $e->getMessage()]);
        }

        return back()->with('toast', ['type' => 'success', 'message' => 'SSL certificate issued.']);
    }

    public function destroy(Site $site, SslCertificate $certificate, CertbotService $certbot): RedirectResponse
    {
        abort_unless($certificate->site_id === $site->id, 404);

        try {
            $certbot->deleteCertificate($certificate);
        } catch (RuntimeException $e) {
            return back()->withErrors(['ssl' => $e->getMessage()]);
        }

        return back()->with('toast', ['type' => 'success', 'message' => 'SSL certificate removed.']);
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function certificatePayload(?SslCertificate $certificate): ?array
    {
        if ($certificate === null) {
            return null;
        }

        return [
            'id' => $certificate->id,
            'lineage' => $certificate->lineage,
            'domains' => $certificate->domains,
            'status' => $certificate->status,
            'expires_at' => $certificate->expires_at?->toIso8601String(),
            'days_remaining' => $certificate->expires_at?->isFuture()
                ? (int) now()->diffInDays($certificate->expires_at)
                : 0,
            'auto_renew' => $certificate->auto_renew,
        ];
    }
}
