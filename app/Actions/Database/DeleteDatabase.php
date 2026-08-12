<?php

namespace App\Actions\Database;

use App\Models\Database;
use App\Models\Site;
use App\Services\Database\MySqlRemoteAccessService;
use App\Services\Database\MySqlService;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class DeleteDatabase
{
    public function __construct(private readonly MySqlService $mysql) {}

    public function handle(Database $database): void
    {
        if (Site::query()->where('database_id', $database->id)->exists()) {
            throw new RuntimeException(
                'Sites still use this database. Detach them from the database before dropping it.',
            );
        }

        DB::transaction(function () use ($database): void {
            $name = $database->name;
            $wasRemote = (bool) $database->allow_remote;

            try {
                $this->mysql->dropDatabase($name);
            } catch (Throwable $e) {
                throw new RuntimeException("Could not delete database: {$e->getMessage()}");
            }

            $database->delete();

            if ($wasRemote) {
                app(MySqlRemoteAccessService::class)->sync();
            }

            activity()->with(['name' => $name])->log('database.deleted');
        });
    }
}
