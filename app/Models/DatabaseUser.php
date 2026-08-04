<?php

namespace App\Models;

use Database\Factories\DatabaseUserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $server_id
 * @property string $username
 * @property string $password
 * @property string $host
 * @property string $status
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read DatabaseUserDatabase $pivot
 */
class DatabaseUser extends Model
{
    /** @use HasFactory<DatabaseUserFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'server_id',
        'username',
        'password',
        'host',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'encrypted',
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
     * @return BelongsToMany<Database, $this, DatabaseUserDatabase>
     */
    public function databases(): BelongsToMany
    {
        return $this->belongsToMany(Database::class, 'database_user_database')
            ->using(DatabaseUserDatabase::class)
            ->withPivot(['privileges', 'custom_grants']);
    }

    /**
     * @return HasMany<Site, $this>
     */
    public function sites(): HasMany
    {
        return $this->hasMany(Site::class);
    }
}
