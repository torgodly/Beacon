<?php

namespace App\Console\Commands;

use App\Services\Server\HealthCheckService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('beacon:doctor')]
#[Description('Run Beacon host and runtime health checks')]
class DoctorCommand extends Command
{
    public function handle(HealthCheckService $health): int
    {
        $result = $health->check();

        if ($result['issues'] === []) {
            $this->components->info('All checks passed.');

            return self::SUCCESS;
        }

        foreach ($result['issues'] as $issue) {
            $line = "[{$issue['severity']}] {$issue['message']}";

            match ($issue['severity']) {
                'critical' => $this->components->error($line),
                default => $this->components->warn($line),
            };
        }

        return $result['healthy'] ? self::SUCCESS : self::FAILURE;
    }
}
