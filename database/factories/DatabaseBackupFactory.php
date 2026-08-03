<?php

namespace Database\Factories;

use App\Models\Database;
use App\Models\DatabaseBackup;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<DatabaseBackup>
 */
class DatabaseBackupFactory extends Factory
{
    protected $model = DatabaseBackup::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $uuid = (string) Str::uuid();

        return [
            'uuid' => $uuid,
            'database_id' => Database::factory(),
            'filename' => 'app_'.$uuid.'.sql.gz',
            'path' => storage_path("framework/testing/backups/app_{$uuid}.sql.gz"),
            'size_bytes' => fake()->numberBetween(1024, 1048576),
            'status' => 'success',
            'error' => null,
            'started_at' => now()->subMinutes(2),
            'finished_at' => now()->subMinute(),
            'expires_at' => now()->addDays(30),
        ];
    }
}
