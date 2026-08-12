<?php

namespace App\Actions\Database;

use App\Models\Database;
use App\Services\Database\MySqlRemoteAccessService;
use RuntimeException;
use Throwable;

class UpdateDatabaseAccess
{
    public function handle(Database $database, bool $allowRemote): Database
    {
        if ((bool) $database->allow_remote === $allowRemote) {
            return $database;
        }

        try {
            $database->update(['allow_remote' => $allowRemote]);
            app(MySqlRemoteAccessService::class)->sync();
        } catch (Throwable $e) {
            throw new RuntimeException($e->getMessage(), previous: $e);
        }

        activity()->with([
            'name' => $database->name,
            'allow_remote' => $allowRemote,
        ])->log($allowRemote ? 'database.remote_enabled' : 'database.remote_disabled');

        return $database->fresh() ?? $database;
    }
}
