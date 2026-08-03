<?php

namespace App\Actions\Site;

use App\Models\Site;
use App\Services\Nginx\NginxService;
use App\Services\Php\PhpPoolWriter;
use App\Services\Ssl\CertbotService;
use App\Services\System\ProcessRunner;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DeleteSite
{
    public function __construct(
        private readonly NginxService $nginx,
        private readonly PhpPoolWriter $pools,
        private readonly ProcessRunner $runner,
        private readonly CertbotService $certbot,
    ) {}

    public function handle(Site $site, string $confirmation): void
    {
        if ($confirmation !== $site->name) {
            throw new RuntimeException('Site name confirmation did not match.');
        }

        DB::transaction(function () use ($site): void {
            $site->activity()->log('site.deleting');

            $this->nginx->delete($site);
            $this->certbot->deleteAllForSite($site);
            $this->pools->delete($site);

            $result = $this->runner->asSite(
                argv: ['/bin/rm', '-rf', $site->path],
                cwd: rtrim((string) config('beacon.paths.sites_home'), '/'),
            );

            if ($result->failed()) {
                throw new RuntimeException("Could not remove site directory: {$result->errorOutput()}");
            }

            $this->runner->asSite(
                argv: ['/bin/rm', '-f', $site->deployScriptPath()],
                cwd: rtrim((string) config('beacon.paths.sites_home'), '/'),
            );

            $site->delete();
        });
    }
}
