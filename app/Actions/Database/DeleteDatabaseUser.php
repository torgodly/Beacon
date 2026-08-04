<?php

namespace App\Actions\Database;

use App\Models\DatabaseUser;
use App\Models\Site;
use App\Services\Database\MySqlService;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class DeleteDatabaseUser
{
    public function __construct(private readonly MySqlService $mysql) {}

    public function handle(DatabaseUser $user): void
    {
        if (Site::query()->where('database_user_id', $user->id)->exists()) {
            throw new RuntimeException(
                'This user is linked to a site. Change the site database settings before deleting the user.',
            );
        }

        DB::transaction(function () use ($user): void {
            $user->load('databases');

            try {
                foreach ($user->databases as $database) {
                    $this->mysql->revokeAll($user->username, $database->name, $user->host);
                }

                $this->mysql->dropUser($user->username, $user->host);
            } catch (Throwable $e) {
                throw new RuntimeException("Could not delete database user: {$e->getMessage()}");
            }

            $user->databases()->detach();
            $user->delete();

            activity()->with(['username' => $user->username])->log('database.user_deleted');
        });
    }
}
