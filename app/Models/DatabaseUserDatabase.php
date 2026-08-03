<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * @property string|null $privileges
 * @property string|null $custom_grants
 */
class DatabaseUserDatabase extends Pivot
{
    protected $table = 'database_user_database';
}
