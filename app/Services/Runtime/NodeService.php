<?php

namespace App\Services\Runtime;

use App\Models\NodeVersion;
use App\Models\Server;
use Illuminate\Support\Facades\File;

class NodeService
{
    /**
     * Reconcile installed Node.js and Bun runtimes with the database.
     */
    public function sync(Server $server): void
    {
        $discoveredNode = collect(File::glob('/usr/local/node/v*/bin/node'))
            ->map(function (string $path): ?string {
                if (! preg_match('#/usr/local/node/v([\d.]+)/bin/node$#', $path, $matches)) {
                    return null;
                }

                return $matches[1];
            })
            ->filter()
            ->unique()
            ->values();

        foreach ($discoveredNode as $version) {
            NodeVersion::query()->updateOrCreate(
                [
                    'server_id' => $server->id,
                    'runtime' => 'node',
                    'version' => $version,
                ],
                [
                    'path' => "/usr/local/node/v{$version}/bin",
                    'status' => 'installed',
                ],
            );
        }

        NodeVersion::query()
            ->where('server_id', $server->id)
            ->where('runtime', 'node')
            ->whereNotIn('version', $discoveredNode->all())
            ->update(['status' => 'missing']);

        $bunPath = '/usr/local/bun/default/bin/bun';

        if (is_executable($bunPath)) {
            $version = trim((string) shell_exec("{$bunPath} --version 2>/dev/null")) ?: 'latest';

            NodeVersion::query()->updateOrCreate(
                [
                    'server_id' => $server->id,
                    'runtime' => 'bun',
                    'version' => ltrim($version, 'v'),
                ],
                [
                    'path' => dirname($bunPath),
                    'status' => 'installed',
                ],
            );
        } else {
            NodeVersion::query()
                ->where('server_id', $server->id)
                ->where('runtime', 'bun')
                ->update(['status' => 'missing']);
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function list(Server $server): array
    {
        return array_values(NodeVersion::query()
            ->where('server_id', $server->id)
            ->orderBy('runtime')
            ->orderBy('version')
            ->get()
            ->map(fn (NodeVersion $runtime): array => [
                'id' => $runtime->id,
                'runtime' => $runtime->runtime,
                'version' => $runtime->version,
                'path' => $runtime->path,
                'status' => $runtime->status,
                'is_default' => $runtime->is_default,
            ])
            ->all());
    }

    public function setDefaultNode(Server $server, NodeVersion $runtime): void
    {
        abort_unless($runtime->server_id === $server->id && $runtime->runtime === 'node', 404);

        NodeVersion::query()
            ->where('server_id', $server->id)
            ->where('runtime', 'node')
            ->update(['is_default' => false]);

        $runtime->update(['is_default' => true]);
        $server->update(['default_node_version' => $runtime->version]);
    }

    public function setDefaultPackageManager(Server $server, string $manager): void
    {
        abort_unless(in_array($manager, ['npm', 'bun'], true), 422);

        $server->update(['default_package_manager' => $manager]);
    }
}
