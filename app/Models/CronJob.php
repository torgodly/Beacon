<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $server_id
 * @property int|null $site_id
 * @property string $name
 * @property string $command
 * @property string $run_as
 * @property string $expression
 * @property string|null $frequency_preset
 * @property bool $is_laravel_scheduler
 * @property string|null $output_redirect
 * @property bool $enabled
 * @property bool $is_system
 * @property Carbon|null $last_ran_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class CronJob extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'server_id',
        'site_id',
        'name',
        'command',
        'run_as',
        'expression',
        'frequency_preset',
        'is_laravel_scheduler',
        'output_redirect',
        'enabled',
        'is_system',
        'last_ran_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_laravel_scheduler' => 'boolean',
            'enabled' => 'boolean',
            'is_system' => 'boolean',
            'last_ran_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Server, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    /**
     * @return BelongsTo<Site, $this>
     */
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }
}
