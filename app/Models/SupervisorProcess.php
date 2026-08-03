<?php

namespace App\Models;

use Database\Factories\SupervisorProcessFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int|null $site_id
 * @property string $name
 * @property string $program_name
 * @property string $kind
 * @property string $command
 * @property string $directory
 * @property string $run_as
 * @property int $numprocs
 * @property bool $autostart
 * @property bool $autorestart
 * @property int $stop_wait_secs
 * @property string $stop_signal
 * @property array<string, string>|null $environment
 * @property string|null $connection
 * @property string|null $queue
 * @property int|null $tries
 * @property int|null $job_timeout
 * @property int|null $sleep
 * @property int|null $max_time
 * @property int|null $backoff
 * @property int|null $rest
 * @property string|null $config_path
 * @property string|null $log_path
 * @property string $status
 * @property string|null $status_message
 * @property Carbon|null $last_status_at
 * @property bool $is_system
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class SupervisorProcess extends Model
{
    /** @use HasFactory<SupervisorProcessFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'site_id',
        'name',
        'program_name',
        'kind',
        'command',
        'directory',
        'run_as',
        'numprocs',
        'autostart',
        'autorestart',
        'stop_wait_secs',
        'stop_signal',
        'environment',
        'connection',
        'queue',
        'tries',
        'job_timeout',
        'sleep',
        'max_time',
        'backoff',
        'rest',
        'config_path',
        'log_path',
        'status',
        'status_message',
        'last_status_at',
        'is_system',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'numprocs' => 'integer',
            'autostart' => 'boolean',
            'autorestart' => 'boolean',
            'stop_wait_secs' => 'integer',
            'environment' => 'array',
            'tries' => 'integer',
            'job_timeout' => 'integer',
            'sleep' => 'integer',
            'max_time' => 'integer',
            'backoff' => 'integer',
            'rest' => 'integer',
            'last_status_at' => 'datetime',
            'is_system' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Site, $this>
     */
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }
}
