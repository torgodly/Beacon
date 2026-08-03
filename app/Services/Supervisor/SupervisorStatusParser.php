<?php

namespace App\Services\Supervisor;

class SupervisorStatusParser
{
    /**
     * @return array{status: string, message: string|null}
     */
    public function parseLine(string $line): array
    {
        $line = trim($line);

        if ($line === '' || str_contains($line, 'no such process')) {
            return ['status' => 'stopped', 'message' => null];
        }

        if (preg_match('/^(?<name>\S+)\s+(?<state>RUNNING|STOPPED|STARTING|STOPPING|BACKOFF|FATAL|EXITED|UNKNOWN)(?:\s+(?<detail>.*))?$/', $line, $matches)) {
            $state = strtolower($matches['state']);

            return [
                'status' => match ($state) {
                    'running' => 'running',
                    'starting' => 'starting',
                    'stopping' => 'stopping',
                    'backoff', 'fatal', 'exited' => 'failed',
                    default => 'stopped',
                },
                'message' => isset($matches['detail']) && $matches['detail'] !== '' ? trim($matches['detail']) : null,
            ];
        }

        return ['status' => 'unknown', 'message' => $line];
    }
}
