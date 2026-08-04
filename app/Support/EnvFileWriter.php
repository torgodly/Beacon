<?php

namespace App\Support;

use RuntimeException;

class EnvFileWriter
{
    /**
     * Format a value for safe storage in a Laravel .env file.
     *
     * Unquoted values break when they contain `#` (comments) or whitespace.
     * Double-quoted values must escape `\`, `"`, and `$` (variable expansion).
     */
    public static function formatValue(string $value): string
    {
        if ($value === '') {
            return '""';
        }

        if (preg_match('/^[A-Za-z0-9_.@:-]+$/', $value)) {
            return $value;
        }

        return '"'.addcslashes($value, "\\\"\$\0").'"';
    }

    public static function set(string $path, string $key, string $value): void
    {
        if ($key === '') {
            return;
        }

        if (! is_file($path)) {
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES);

        if ($lines === false) {
            throw new RuntimeException("Could not read env file: {$path}");
        }

        $formatted = $key.'='.self::formatValue($value);
        $found = false;

        foreach ($lines as $index => $line) {
            if (str_starts_with($line, $key.'=')) {
                $lines[$index] = $formatted;
                $found = true;

                break;
            }
        }

        if (! $found) {
            $lines[] = $formatted;
        }

        file_put_contents($path, implode("\n", $lines)."\n");
    }
}
