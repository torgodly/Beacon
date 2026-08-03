<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $server_id
 * @property string $cpu_percent
 * @property int $memory_used_mb
 * @property int $memory_total_mb
 * @property int $swap_used_mb
 * @property int $disk_used_mb
 * @property int $disk_total_mb
 * @property string $load_1
 * @property string $load_5
 * @property string $load_15
 * @property int $uptime_seconds
 * @property Carbon $recorded_at
 */
class ServerMetric extends Model
{
    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'server_id',
        'cpu_percent',
        'memory_used_mb',
        'memory_total_mb',
        'swap_used_mb',
        'disk_used_mb',
        'disk_total_mb',
        'load_1',
        'load_5',
        'load_15',
        'uptime_seconds',
        'recorded_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cpu_percent' => 'decimal:2',
            'memory_used_mb' => 'integer',
            'memory_total_mb' => 'integer',
            'swap_used_mb' => 'integer',
            'disk_used_mb' => 'integer',
            'disk_total_mb' => 'integer',
            'load_1' => 'decimal:2',
            'load_5' => 'decimal:2',
            'load_15' => 'decimal:2',
            'uptime_seconds' => 'integer',
            'recorded_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Server, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }
}
