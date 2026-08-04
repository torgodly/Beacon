<?php

namespace App\Actions\Site;

use App\Actions\Database\CreateDatabase;
use App\Actions\Database\CreateDatabaseUser;
use App\Models\Database;
use App\Models\DatabaseUser;
use App\Models\Server;
use App\Models\Site;
use App\Services\Database\DatabaseNaming;
use RuntimeException;

class ProvisionSiteDatabase
{
    public function __construct(
        private readonly CreateDatabase $createDatabase,
        private readonly CreateDatabaseUser $createDatabaseUser,
    ) {}

    /**
     * @param  array{database_strategy?: string|null, database_id?: int|null, database_name?: string|null}  $data
     */
    public function handle(Site $site, array $data): void
    {
        if ($site->type !== 'laravel') {
            return;
        }

        if (($data['database_driver'] ?? $site->database_driver) === 'sqlite') {
            return;
        }

        $strategy = $data['database_strategy'] ?? 'none';

        if ($strategy === 'none') {
            return;
        }

        $server = Server::current();

        $database = match ($strategy) {
            'create' => $this->createDatabase->handle(
                $server,
                (string) ($data['database_name'] ?? DatabaseNaming::databaseFromSite($site->name)),
            ),
            'existing' => $this->resolveExistingDatabase($server, $data),
            default => throw new RuntimeException('Unknown database strategy.'),
        };

        ['user' => $user] = $this->createDatabaseUser->handle(
            $server,
            $this->uniqueUsername($server, DatabaseNaming::usernameFromSite($site->name)),
            $database,
            'all',
        );

        $site->update([
            'database_id' => $database->id,
            'database_user_id' => $user->id,
        ]);
    }

    /**
     * @param  array{database_id?: int|null}  $data
     */
    private function resolveExistingDatabase(Server $server, array $data): Database
    {
        $database = Database::query()
            ->where('server_id', $server->id)
            ->whereKey($data['database_id'] ?? null)
            ->first();

        if ($database === null) {
            throw new RuntimeException('The selected database could not be found on this server.');
        }

        return $database;
    }

    private function uniqueUsername(Server $server, string $base): string
    {
        $candidate = substr($base, 0, 32);

        if (! DatabaseUser::query()->where('server_id', $server->id)->where('username', $candidate)->exists()) {
            return $candidate;
        }

        for ($suffix = 2; $suffix < 100; $suffix++) {
            $next = substr($base, 0, max(1, 32 - strlen((string) $suffix))).$suffix;

            if (! DatabaseUser::query()->where('server_id', $server->id)->where('username', $next)->exists()) {
                return $next;
            }
        }

        throw new RuntimeException('Could not allocate a unique database username for this site.');
    }
}
