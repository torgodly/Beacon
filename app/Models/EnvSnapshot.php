<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $site_id
 * @property int|null $user_id
 * @property string $contents
 * @property Carbon|null $created_at
 */
class EnvSnapshot extends Model
{
    public const UPDATED_AT = null;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'site_id',
        'user_id',
        'contents',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'contents' => 'encrypted',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Site, $this>
     */
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
