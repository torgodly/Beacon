<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $php_version_id
 * @property string $name
 * @property string|null $label
 * @property string|null $apt_package
 * @property bool $is_installed
 * @property bool $is_enabled
 * @property bool $is_core
 * @property Carbon|null $last_synced_at
 */
class PhpExtension extends Model
{
    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'php_version_id',
        'name',
        'label',
        'apt_package',
        'is_installed',
        'is_enabled',
        'is_core',
        'last_synced_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_installed' => 'boolean',
            'is_enabled' => 'boolean',
            'is_core' => 'boolean',
            'last_synced_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<PhpVersion, $this>
     */
    public function phpVersion(): BelongsTo
    {
        return $this->belongsTo(PhpVersion::class);
    }
}
