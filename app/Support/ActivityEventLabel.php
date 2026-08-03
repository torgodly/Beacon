<?php

namespace App\Support;

class ActivityEventLabel
{
    /**
     * @return array{label: string, tone: string}
     */
    public static function for(string $event): array
    {
        return match (true) {
            str_starts_with($event, 'site.') => [
                'label' => self::humanize($event, 'Site'),
                'tone' => 'info',
            ],
            str_starts_with($event, 'domain.') => [
                'label' => self::humanize($event, 'Domain'),
                'tone' => 'info',
            ],
            str_starts_with($event, 'ssl.') => [
                'label' => self::humanize($event, 'SSL'),
                'tone' => 'success',
            ],
            str_starts_with($event, 'deployment.') => [
                'label' => self::humanize($event, 'Deployment'),
                'tone' => 'info',
            ],
            str_starts_with($event, 'database.') => [
                'label' => self::humanize($event, 'Database'),
                'tone' => 'info',
            ],
            default => [
                'label' => self::humanize($event),
                'tone' => 'info',
            ],
        };
    }

    private static function humanize(string $event, ?string $prefix = null): string
    {
        $parts = explode('.', $event, 2);
        $action = str_replace('_', ' ', $parts[1] ?? $parts[0]);

        if ($prefix !== null) {
            return "{$prefix} {$action}";
        }

        return ucfirst(str_replace('.', ' ', $event));
    }
}
