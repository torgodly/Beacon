<?php

use App\Support\ActivityLogger;

if (! function_exists('activity')) {
    /**
     * Start a fluent activity-log entry.
     *
     * @see ActivityLogger
     */
    function activity(): ActivityLogger
    {
        return new ActivityLogger;
    }
}
