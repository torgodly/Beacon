<?php

namespace App\Services\Nginx;

use App\Models\Site;
use App\Services\System\ProcessRunner;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

class PortAllocator
{
    public function allocate(): int
    {
        $min = (int) config('beacon.port_range.min', 3000);
        $max = (int) config('beacon.port_range.max', 3999);

        return Cache::lock('beacon:port-alloc', 10)->block(5, function () use ($min, $max): int {
            $usedInDb = Site::query()
                ->whereNotNull('proxy_port')
                ->pluck('proxy_port')
                ->all();

            $usedOnHost = $this->usedPortsFromSocketTable();

            for ($port = $min; $port <= $max; $port++) {
                if (in_array($port, $usedInDb, true) || in_array($port, $usedOnHost, true)) {
                    continue;
                }

                return $port;
            }

            throw new RuntimeException('No free proxy ports remain in the configured range.');
        });
    }

    /**
     * @return list<int>
     */
    private function usedPortsFromSocketTable(): array
    {
        $result = app(ProcessRunner::class)->run(['ss', '-ltn']);

        if ($result->failed()) {
            return [];
        }

        preg_match_all('/:(\d+)\s/', $result->output(), $matches);

        return array_map(intval(...), $matches[1]);
    }
}
