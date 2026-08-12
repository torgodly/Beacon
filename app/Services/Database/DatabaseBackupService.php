<?php

namespace App\Services\Database;

use App\Jobs\BackupDatabase;
use App\Models\Database;
use App\Models\DatabaseBackup;
use App\Models\DatabaseUser;
use App\Models\Server;
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
     * @return array<int, array{user_id: int, username: string, host: string, connect_host: string, remote: bool, laravel: string, url: string, tableplus: string}>
     */
    public function connectionStrings(Database $database): array
    {
        $database->loadMissing('users');

        $serverIp = Server::current()->public_ip;
        $port = (string) config('database.connections.mysql_admin.port', '3306');

        return $database->users->map(function (DatabaseUser $user) use ($database, $serverIp, $port): array {
            $password = $user->password;
            // When remote is enabled, connection helpers point at the public IP so
            // TablePlus / laptop clients work. Sites on the server still use 127.0.0.1
            // via BEACON_DB_HOST on deploy — not these clipboard helpers.
            $host = $database->allow_remote ? $serverIp : '127.0.0.1';
            $encodedUser = rawurlencode($user->username);
            $encodedPassword = rawurlencode($password);

            return [
                'user_id' => $user->id,
                'username' => $user->username,
                'host' => $user->host,
                'connect_host' => $host,
                'remote' => (bool) $database->allow_remote,
                'laravel' => implode("\n", [
                    'DB_CONNECTION=mysql',
                    "DB_HOST={$host}",
                    "DB_PORT={$port}",
                    "DB_DATABASE={$database->name}",
                    "DB_USERNAME={$user->username}",
                    "DB_PASSWORD={$password}",
                ]),
                'url' => "mysql://{$encodedUser}:{$encodedPassword}@{$host}:{$port}/{$database->name}",
                'tableplus' => 'tableplus://connections/new?'.http_build_query([
                    'type' => 'mysql',
                    'name' => $database->name,
                    'host' => $host,
                    'port' => $port,
                    'user' => $user->username,
                    'password' => $password,
                    'database' => $database->name,
                ], '', '&', PHP_QUERY_RFC3986),
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
