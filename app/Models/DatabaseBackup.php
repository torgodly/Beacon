<?php

namespace App\Models;

use Database\Factories\DatabaseBackupFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property int $database_id
 * @property string $filename
 * @property string $path
 * @property int|null $size_bytes
 * @property string $status
 * @property string|null $error
 * @property Carbon|null $started_at
 * @property Carbon|null $finished_at
 * @property Carbon|null $expires_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class DatabaseBackup extends Model
{
    /** @use HasFactory<DatabaseBackupFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'uuid',
        'database_id',
        'filename',
        'path',
        'size_bytes',
        'status',
        'error',
        'started_at',
        'finished_at',
        'expires_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (DatabaseBackup $backup): void {
            if (blank($backup->uuid)) {
                $backup->uuid = (string) Str::uuid();
            }
        });
    }

    /**
     * @return BelongsTo<Database, $this>
     */
    public function database(): BelongsTo
    {
        return $this->belongsTo(Database::class);
    }
}
