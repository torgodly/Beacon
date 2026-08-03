<?php

namespace App\Services\Nginx;

use App\Models\Site;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class NginxService
{
    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly NginxTemplateRenderer $renderer,
        private readonly NginxHttp2Directive $http2,
    ) {}

    public function http2Inline(): bool
    {
        return $this->http2->inline();
    }

    public function read(Site $site): string
    {
        $result = $this->runner->sudoRoot(SudoWrapper::Nginx, ['read', $site->name]);

        if ($result->exitCode() === 66) {
            return $this->renderer->render($site);
        }

        if ($result->failed()) {
            throw new RuntimeException("Could not read nginx config: {$result->errorOutput()}");
        }

        return $result->output();
    }

    public function generateAndApply(Site $site): void
    {
        if ($site->nginx_customized) {
            return;
        }

        $contents = $this->renderer->render($site);
        $this->writeValidated($site, $contents, customized: false);
        $this->enable($site);
        $this->reload();
    }

    public function saveRaw(Site $site, string $contents): void
    {
        $this->writeValidated($site, $contents, customized: true);
        $this->reload();
        $site->activity()->log('nginx.saved');
    }

    public function resetToGenerated(Site $site): void
    {
        $contents = $this->renderer->render($site);
        $this->writeValidated($site, $contents, customized: false);
        $this->reload();
        $site->activity()->log('nginx.reset');
    }

    public function previewGenerated(Site $site): string
    {
        return $this->renderer->render($site);
    }

    public function enable(Site $site): void
    {
        $result = $this->runner->sudoRoot(SudoWrapper::Nginx, ['enable', $site->name]);

        if ($result->failed() && $result->exitCode() !== 66) {
            throw new RuntimeException("Could not enable site: {$result->errorOutput()}");
        }
    }

    public function disable(Site $site): void
    {
        $this->runner->sudoRoot(SudoWrapper::Nginx, ['disable', $site->name]);
    }

    public function delete(Site $site): void
    {
        $this->runner->sudoRoot(SudoWrapper::Nginx, ['delete', $site->name]);
    }

    public function reload(): void
    {
        $result = $this->runner->sudoRoot(SudoWrapper::Nginx, ['reload']);

        if ($result->failed()) {
            throw new RuntimeException("Nginx reload failed: {$result->errorOutput()}");
        }
    }

    private function writeValidated(Site $site, string $contents, bool $customized): void
    {
        $result = $this->runner->sudoRoot(SudoWrapper::Nginx, ['write', $site->name], stdin: $contents);

        if ($result->exitCode() === 65) {
            $parsed = NginxErrorParser::humanize($result->errorOutput());

            throw ValidationException::withMessages([
                'contents' => $parsed['message'],
                'error_line' => $parsed['line'],
            ]);
        }

        if ($result->failed()) {
            throw new RuntimeException("nginx write failed: {$result->errorOutput()}");
        }

        $site->update([
            'nginx_customized' => $customized,
            'nginx_managed_hash' => hash('sha256', $contents),
        ]);
    }
}
