<?php

namespace App\Services\Runtime;

class MemoryBudget
{
    /**
     * V8 heap cap at ~65% of physical RAM — prevents OOM kills during Node builds.
     */
    public static function nodeHeapMb(): int
    {
        $meminfo = @file_get_contents('/proc/meminfo');
        $totalMb = 2048;

        if (is_string($meminfo) && preg_match('/MemTotal:\s+(\d+)\s+kB/', $meminfo, $matches)) {
            $totalMb = (int) floor(((int) $matches[1]) / 1024);
        }

        return max(512, (int) floor($totalMb * 0.65));
    }
}
