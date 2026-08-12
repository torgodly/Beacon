<?php

namespace App\Actions\Database;

use App\Models\Database;
use App\Models\Server;
use App\Services\Database\MySqlRemoteAccessService;
use App\Services\Database\MySqlService;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class CreateDatabase
{
    public function __construct(private readonly MySqlService $mysql) {}

    public function handle(Server $server, string $name, bool $allowRemote = false): Database
    {
        return DB::transaction(function () use ($server, $name, $allowRemote): Database {
            try {
                $this->mysql->createDatabase($name);
            } catch (Throwable $e) {
                throw new RuntimeException("Could not create database: {$e->getMessage()}");
            }

            $database = Database::query()->create([
                'server_id' => $server->id,
                'name' => $name,
                'status' => 'active',
                'allow_remote' => $allowRemote,
            ]);

            if ($allowRemote) {
                app(MySqlRemoteAccessService::class)->sync();
            }

            activity()->with(['name' => $name, 'allow_remote' => $allowRemote])->log('database.created');

            return $database;
        });
    }
}
