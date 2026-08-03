<?php

namespace App\Services\Database;

use App\Jobs\BackupDatabase;
use App\Models\Database;
use App\Models\DatabaseBackup;
use App\Models\DatabaseUser;
use App\Services\System\ProcessRunner;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class DatabaseBackupService
{
    public function __construct(private readonly ProcessRunner $runner) {}

    public function queue(Database $database): DatabaseBackup
    {
        $directory = $this->backupDirectory($database);
        File::ensureDirectoryExists($directory);

        $uuid = (string) Str::uuid();
        $filename = "{$database->name}-{$uuid}.sql.gz";
        $path = "{$directory}/{$filename}";

        $backup = $database->backups()->create([
            'uuid' => $uuid,
            'filename' => $filename,
            'path' => $path,
            'status' => 'queued',
            'expires_at' => now()->addDays(30),
        ]);

        BackupDatabase::dispatch($backup);

        return $backup;
    }

    public function run(DatabaseBackup $backup): void
    {
        $backup->refresh();

        if (! in_array($backup->status, ['queued', 'running'], true)) {
            return;
        }

        $database = $backup->database;
        $startedAt = now();

        $backup->update([
            'status' => 'running',
            'started_at' => $startedAt,
        ]);

        File::ensureDirectoryExists(dirname($backup->path));

        $connection = config('database.connections.mysql_admin');
        $socket = $connection['unix_socket'] ?? '';
        $username = $connection['username'] ?? 'beacon_admin';
        $password = $connection['password'] ?? '';
        $quotedDatabase = SqlIdentifier::quote($database->name);
        $quotedPath = escapeshellarg($backup->path);

        $socketArg = $socket !== ''
            ? '--socket='.escapeshellarg($socket)
            : '--host='.escapeshellarg($connection['host'] ?? '127.0.0.1');

        $script = sprintf(
            'mysqldump --single-transaction --quick --no-tablespaces --routines --triggers %s -u %s %s | gzip > %s',
            $socketArg,
            escapeshellarg($username),
            $quotedDatabase,
            $quotedPath,
        );

        $result = $this->runner->run(
            command: ['/bin/bash', '-lc', $script],
            env: $password !== '' ? ['MYSQL_PWD' => $password] : [],
            timeout: 600,
        );

        $finishedAt = now();

        if ($result->failed()) {
            File::delete($backup->path);

            $backup->update([
                'status' => 'failed',
                'error' => trim($result->combinedOutput()) ?: 'Backup failed.',
                'finished_at' => $finishedAt,
            ]);

            return;
        }

        $sizeBytes = File::exists($backup->path) ? File::size($backup->path) : null;

        $backup->update([
            'status' => 'success',
            'size_bytes' => $sizeBytes,
            'finished_at' => $finishedAt,
            'error' => null,
        ]);
    }

    /**
     * @return array<int, array{user_id: int, username: string, host: string, laravel: string, url: string}>
     */
    public function connectionStrings(Database $database): array
    {
        $database->loadMissing('users');

        $socket = config('database.connections.mysql_admin.unix_socket', '/var/run/mysqld/mysqld.sock');
        $host = config('database.connections.mysql_admin.host', '127.0.0.1');
        $port = config('database.connections.mysql_admin.port', '3306');

        return $database->users->map(function (DatabaseUser $user) use ($database, $host, $port): array {
            $password = $user->password;

            return [
                'user_id' => $user->id,
                'username' => $user->username,
                'host' => $user->host,
                'laravel' => implode("\n", [
                    'DB_CONNECTION=mysql',
                    "DB_HOST={$host}",
                    "DB_PORT={$port}",
                    "DB_DATABASE={$database->name}",
                    "DB_USERNAME={$user->username}",
                    "DB_PASSWORD={$password}",
                ]),
                'url' => "mysql://{$user->username}:{$password}@{$host}:{$port}/{$database->name}",
            ];
        })->values()->all();
    }

    public function deleteFile(DatabaseBackup $backup): void
    {
        if (File::exists($backup->path)) {
            File::delete($backup->path);
        }
    }

    private function backupDirectory(Database $database): string
    {
        $root = rtrim((string) config('beacon.paths.database_backups'), '/');

        return "{$root}/{$database->name}";
    }
}
