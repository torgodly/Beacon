<?php

namespace App\Actions\Database;

use App\Models\Database;
use App\Services\Database\MySqlService;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class DeleteDatabase
{
    public function __construct(private readonly MySqlService $mysql) {}

    public function handle(Database $database): void
    {
        DB::transaction(function () use ($database): void {
            $name = $database->name;

            try {
                $this->mysql->dropDatabase($name);
            } catch (Throwable $e) {
                throw new RuntimeException("Could not delete database: {$e->getMessage()}");
            }

            $database->delete();

            activity()->with(['name' => $name])->log('database.deleted');
        });
    }
}
