<?php

namespace App\Models;

use Database\Factories\DatabaseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $server_id
 * @property string $name
 * @property string $charset
 * @property string $collation
 * @property string $status
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Database extends Model
{
    /** @use HasFactory<DatabaseFactory> */
    use HasFactory;

    protected $table = 'databases';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'server_id',
        'name',
        'charset',
        'collation',
        'status',
    ];

    /**
     * @return BelongsTo<Server, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    /**
     * @return BelongsToMany<DatabaseUser, $this, DatabaseUserDatabase>
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(DatabaseUser::class, 'database_user_database')
            ->using(DatabaseUserDatabase::class)
            ->withPivot(['privileges', 'custom_grants']);
    }

    /**
     * @return HasMany<DatabaseBackup, $this>
     */
    public function backups(): HasMany
    {
        return $this->hasMany(DatabaseBackup::class);
    }
}
