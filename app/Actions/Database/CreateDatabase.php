<?php

namespace App\Actions\Database;

use App\Models\Database;
use App\Models\Server;
use App\Services\Database\MySqlService;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class CreateDatabase
{
    public function __construct(private readonly MySqlService $mysql) {}

    public function handle(Server $server, string $name): Database
    {
        return DB::transaction(function () use ($server, $name): Database {
            try {
                $this->mysql->createDatabase($name);
            } catch (Throwable $e) {
                throw new RuntimeException("Could not create database: {$e->getMessage()}");
            }

            $database = Database::query()->create([
                'server_id' => $server->id,
                'name' => $name,
                'status' => 'active',
            ]);

            activity()->with(['name' => $name])->log('database.created');

            return $database;
        });
    }
}
