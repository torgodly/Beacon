<?php

namespace App\Services\Database;

use InvalidArgumentException;

class SqlIdentifier
{
    public static function quote(string $identifier): string
    {
        if (! preg_match('/^[A-Za-z0-9_]{1,64}$/', $identifier)) {
            throw new InvalidArgumentException("Invalid SQL identifier: {$identifier}");
        }

        return '`'.str_replace('`', '``', $identifier).'`';
    }

    public static function quoteUser(string $username): string
    {
        if (! preg_match('/^[A-Za-z0-9_]{1,32}$/', $username)) {
            throw new InvalidArgumentException("Invalid database username: {$username}");
        }

        return "'".str_replace("'", "''", $username)."'";
    }

    public static function quoteHost(string $host): string
    {
        if ($host !== 'localhost' && $host !== '%' && ! filter_var($host, FILTER_VALIDATE_IP)) {
            throw new InvalidArgumentException("Invalid database host: {$host}");
        }

        return "'".str_replace("'", "''", $host)."'";
    }
}
