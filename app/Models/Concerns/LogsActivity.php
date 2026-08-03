<?php

namespace App\Models\Concerns;

use App\Models\ActivityLog;
use App\Support\ActivityLogger;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * Adds an `activityLogs()` relation and a fluent `activity()` starting point
 * scoped to `$this` model, e.g. `$site->activity()->log('site.created')`.
 */
trait LogsActivity
{
    /**
     * @return MorphMany<ActivityLog, $this>
     */
    public function activityLogs(): MorphMany
    {
        return $this->morphMany(ActivityLog::class, 'subject')->latest('id');
    }

    public function activity(): ActivityLogger
    {
        return activity()->on($this);
    }
}
