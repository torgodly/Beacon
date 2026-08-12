<?php

namespace App\Actions\Database;

use App\Models\Database;
use App\Services\Database\MySqlRemoteAccessService;
use App\Services\Database\MySqlService;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class UpdateDatabaseAccess
{
    public function __construct(private readonly MySqlService $mysql) {}

    public function handle(Database $database, bool $allowRemote): Database
    {
        if ((bool) $database->allow_remote === $allowRemote) {
            return $database;
        }

        $fromHost = $allowRemote ? 'localhost' : '%';
        $toHost = $allowRemote ? '%' : 'localhost';

        try {
            DB::transaction(function () use ($database, $allowRemote, $fromHost, $toHost): void {
                $database->load('users');

                foreach ($database->users as $user) {
                    if ($user->host !== $fromHost) {
                        continue;
                    }

                    $this->mysql->renameUserHost($user->username, $fromHost, $toHost);
                    $user->update(['host' => $toHost]);
                }

                $database->update(['allow_remote' => $allowRemote]);
                app(MySqlRemoteAccessService::class)->sync();
            });
        } catch (Throwable $e) {
            throw new RuntimeException($e->getMessage(), previous: $e);
        }

        activity()->with([
            'name' => $database->name,
            'allow_remote' => $allowRemote,
        ])->log($allowRemote ? 'database.remote_enabled' : 'database.remote_disabled');

        return $database->fresh(['users']) ?? $database;
    }
}
