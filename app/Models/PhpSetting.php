<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $php_version_id
 * @property string $sapi
 * @property string $key
 * @property string $value
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class PhpSetting extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'php_version_id',
        'sapi',
        'key',
        'value',
    ];

    /**
     * @return BelongsTo<PhpVersion, $this>
     */
    public function phpVersion(): BelongsTo
    {
        return $this->belongsTo(PhpVersion::class);
    }
}
