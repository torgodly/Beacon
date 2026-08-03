<?php

namespace App\Actions\Database;

use App\Models\Database;
use App\Models\DatabaseUser;
use App\Models\Server;
use App\Services\Database\MySqlService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class CreateDatabaseUser
{
    public function __construct(private readonly MySqlService $mysql) {}

    /**
     * @return array{user: DatabaseUser, password: string}
     */
    public function handle(
        Server $server,
        string $username,
        ?Database $database = null,
        string $privileges = 'all',
    ): array {
        return DB::transaction(function () use ($server, $username, $database, $privileges): array {
            $password = Str::password(24);

            try {
                $this->mysql->createUser($username, $password);

                if ($database !== null) {
                    $this->mysql->grant($username, $database->name, $privileges);
                }
            } catch (Throwable $e) {
                throw new RuntimeException("Could not create database user: {$e->getMessage()}");
            }

            $user = DatabaseUser::query()->create([
                'server_id' => $server->id,
                'username' => $username,
                'password' => $password,
                'host' => 'localhost',
                'status' => 'active',
            ]);

            if ($database !== null) {
                $user->databases()->attach($database->id, [
                    'privileges' => $privileges,
                ]);
            }

            activity()->with([
                'username' => $username,
                'database' => $database?->name,
            ])->log('database.user_created');

            return ['user' => $user, 'password' => $password];
        });
    }
}
