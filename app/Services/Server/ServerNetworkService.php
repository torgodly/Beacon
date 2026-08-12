<?php

namespace App\Services\Server;

use App\Models\Server;
use App\Services\System\ProcessRunner;

class ServerNetworkService
{
    public function __construct(private readonly ProcessRunner $runner) {}

    public function detectPrimaryIpv4(): ?string
    {
        $script = <<<'BASH'
addr="$(hostname -I 2>/dev/null | awk '{print $1; exit}')"
[[ -z "$addr" ]] && addr="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')"
printf '%s' "$addr"
BASH;

        $result = $this->runner->run(['/bin/bash', '-lc', $script], timeout: 5);
        $ip = trim($result->output());

        if ($ip === '' || ! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            return null;
        }

        if ($this->isLoopback($ip)) {
            return null;
        }

        return $ip;
    }

    public function syncPublicIp(Server $server): bool
    {
        if (! $this->isPlaceholderIp($server->public_ip)) {
            return false;
        }

        $detected = $this->detectPrimaryIpv4();

        if ($detected === null || $detected === $server->public_ip) {
            return false;
        }

        $server->update(['public_ip' => $detected]);

        return true;
    }

    private function isPlaceholderIp(string $ip): bool
    {
        return in_array($ip, ['127.0.0.1', '::1', 'localhost', 'this-server', ''], true);
    }

    private function isLoopback(string $ip): bool
    {
        return str_starts_with($ip, '127.') || $ip === '::1';
    }
}
