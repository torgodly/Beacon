<?php

namespace App\Services\Nginx;

class NginxErrorParser
{
    /**
     * @return array{line: int|null, directive: string|null, message: string}
     */
    public static function humanize(string $output): array
    {
        if (preg_match('/\[emerg\]\s+(.+?)\s+in\s+\S+:(\d+)/', $output, $matches)) {
            $message = $matches[1];
            $line = (int) $matches[2];
            $directive = null;

            if (preg_match('/unknown directive "([^"]+)"/', $message, $directiveMatch)) {
                $directive = $directiveMatch[1];
            }

            return [
                'line' => $line,
                'directive' => $directive,
                'message' => $message,
            ];
        }

        return [
            'line' => null,
            'directive' => null,
            'message' => trim($output) ?: 'Nginx rejected the configuration.',
        ];
    }
}
