<?php

namespace App\Support;

use App\Models\Database;
use App\Models\Server;
use App\Models\Site;

class CommandPaletteData
{
    /**
     * @return array{
     *     sites: list<array{id: string, name: string}>,
     *     databases: list<array{name: string}>,
     *     server: array{public_ip: string, ssh_public_key: string|null}
     * }
     */
    public function build(): array
    {
        $server = Server::current();
        $sshPath = rtrim((string) config('beacon.paths.ssh_dir'), '/').'/id_ed25519.pub';
        $sshPublicKey = is_readable($sshPath)
            ? trim((string) file_get_contents($sshPath))
            : null;

        $sites = Site::query()
            ->orderBy('name')
            ->get(['name'])
            ->map(fn (Site $site): array => [
                'id' => $site->name,
                'name' => $site->name,
            ])
            ->all();

        $databases = Database::query()
            ->orderBy('name')
            ->get(['name'])
            ->map(fn (Database $database): array => ['name' => $database->name])
            ->all();

        return [
            'sites' => array_values($sites),
            'databases' => array_values($databases),
            'server' => [
                'public_ip' => $server->public_ip,
                'ssh_public_key' => $sshPublicKey,
            ],
        ];
    }
}
