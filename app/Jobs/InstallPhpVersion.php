<?php

namespace App\Jobs;

use App\Models\PhpVersion;
use App\Services\Php\PhpService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class InstallPhpVersion implements ShouldQueue
{
    use Queueable;

    public int $timeout = 700;

    public function __construct(
        public PhpVersion $phpVersion,
        public string $action,
    ) {}

    public function handle(PhpService $php): void
    {
        match ($this->action) {
            'install' => $php->performInstall($this->phpVersion),
            'remove' => $php->performRemove($this->phpVersion),
            default => null,
        };
    }
}
