<?php

namespace App\Models;

use Database\Factories\NodeVersionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $server_id
 * @property string $runtime
 * @property string $version
 * @property string $path
 * @property bool $is_default
 * @property string $status
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class NodeVersion extends Model
{
    /** @use HasFactory<NodeVersionFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'server_id',
        'runtime',
        'version',
        'path',
        'is_default',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
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
