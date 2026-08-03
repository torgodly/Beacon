<?php

namespace App\Services\Nginx;

use App\Services\System\ProcessRunner;
use Illuminate\Support\Facades\Cache;

class NginxHttp2Directive
{
    private const string CACHE_KEY = 'beacon:nginx:http2-inline';

    public function __construct(private readonly ProcessRunner $runner) {}

    public function inline(): bool
    {
        return Cache::rememberForever(self::CACHE_KEY, function (): bool {
            $result = $this->runner->run(['nginx', '-v']);

            if (! preg_match('/nginx\/(\d+)\.(\d+)/', $result->errorOutput().$result->output(), $matches)) {
                return true;
            }

            $major = (int) $matches[1];
            $minor = (int) $matches[2];

            return $major < 1 || ($major === 1 && $minor < 25);
        });
    }
}
