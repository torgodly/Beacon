<?php

namespace App\Services\Database;

use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class MySqlService
{
    public function connection(): Connection
    {
        return DB::connection('mysql_admin');
    }

    public function createDatabase(
        string $name,
        string $charset = 'utf8mb4',
        string $collation = 'utf8mb4_unicode_ci',
    ): void {
        $database = SqlIdentifier::quote($name);

        $this->connection()->statement(
            "CREATE DATABASE {$database} CHARACTER SET {$charset} COLLATE {$collation}",
        );
    }

    public function dropDatabase(string $name): void
    {
        $database = SqlIdentifier::quote($name);

        $this->connection()->statement("DROP DATABASE IF EXISTS {$database}");
    }

    public function createUser(string $username, string $password, string $host = 'localhost'): void
    {
        $user = SqlIdentifier::quoteUser($username);
        $hostLiteral = SqlIdentifier::quoteHost($host);
        $passwordLiteral = $this->connection()->getPdo()->quote($password);

        $this->connection()->statement(
            "CREATE USER {$user}@{$hostLiteral} IDENTIFIED BY {$passwordLiteral}",
        );
    }

    public function dropUser(string $username, string $host = 'localhost'): void
    {
        $user = SqlIdentifier::quoteUser($username);
        $hostLiteral = SqlIdentifier::quoteHost($host);

        $this->connection()->statement("DROP USER IF EXISTS {$user}@{$hostLiteral}");
    }

    public function renameUserHost(string $username, string $fromHost, string $toHost): void
    {
        if ($fromHost === $toHost) {
            return;
        }

        $user = SqlIdentifier::quoteUser($username);
        $from = SqlIdentifier::quoteHost($fromHost);
        $to = SqlIdentifier::quoteHost($toHost);

        $this->connection()->statement(
            "RENAME USER {$user}@{$from} TO {$user}@{$to}",
        );
    }

    public function grant(string $username, string $database, string $privileges, string $host = 'localhost'): void
    {
        $user = SqlIdentifier::quoteUser($username);
        $hostLiteral = SqlIdentifier::quoteHost($host);
        $db = SqlIdentifier::quote($database);

        $grantList = match ($privileges) {
            'all' => 'ALL PRIVILEGES',
            'readonly' => 'SELECT',
            default => throw new RuntimeException("Unsupported privilege level: {$privileges}"),
        };

        $this->connection()->statement(
            "GRANT {$grantList} ON {$db}.* TO {$user}@{$hostLiteral}",
        );
    }

    public function revokeAll(string $username, string $database, string $host = 'localhost'): void
    {
        $user = SqlIdentifier::quoteUser($username);
        $hostLiteral = SqlIdentifier::quoteHost($host);
        $db = SqlIdentifier::quote($database);

        $this->connection()->statement(
            "REVOKE ALL PRIVILEGES ON {$db}.* FROM {$user}@{$hostLiteral}",
        );
    }
}
