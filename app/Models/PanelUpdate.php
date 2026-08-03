<?php

namespace App\Models;

use Database\Factories\PanelUpdateFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property string $action
 * @property string|null $tag
 * @property string $status
 * @property string $log_path
 * @property string|null $error
 * @property int|null $exit_code
 * @property Carbon|null $started_at
 * @property Carbon|null $finished_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class PanelUpdate extends Model
{
    /** @use HasFactory<PanelUpdateFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'uuid',
        'action',
        'tag',
        'status',
        'log_path',
        'error',
        'exit_code',
        'started_at',
        'finished_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'exit_code' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (PanelUpdate $update): void {
            if (blank($update->uuid)) {
                $update->uuid = (string) Str::uuid();
            }
        });
    }
}
