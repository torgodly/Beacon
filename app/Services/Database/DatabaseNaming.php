<?php

namespace App\Services\Database;

use Illuminate\Support\Str;

class DatabaseNaming
{
    public static function databaseFromSite(string $siteName): string
    {
        $name = Str::of($siteName)
            ->lower()
            ->replace(['.', '-'], '_')
            ->replaceMatches('/[^a-z0-9_]/', '')
            ->trim('_')
            ->toString();

        if ($name === '') {
            $name = 'site';
        }

        return substr($name, 0, 64);
    }

    public static function usernameFromSite(string $siteName): string
    {
        $username = self::databaseFromSite($siteName).'_user';

        return substr($username, 0, 32);
    }
}
