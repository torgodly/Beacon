<?php

namespace App\Support;

use App\Models\ActivityLog;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;

/**
 * Fluent builder for {@see ActivityLog} rows.
 *
 * ```php
 * activity()->on($site)->by($user)->with(['php_version' => '8.4'])->log('site.php_version_changed');
 * ```
 *
 * Every part is optional except the final `log()` call: `activity()->log('server.rebooted')`
 * records a subject-less, system-attributed event.
 */
class ActivityLogger
{
    private ?Model $subject = null;

    private Authenticatable|int|null $causer = null;

    /** @var array<string, mixed> */
    private array $properties = [];

    private ?string $description = null;

    public function on(Model $subject): static
    {
        $this->subject = $subject;

        return $this;
    }

    public function by(Authenticatable|int|null $user): static
    {
        $this->causer = $user;

        return $this;
    }

    /**
     * @param  array<string, mixed>  $properties
     */
    public function with(array $properties): static
    {
        $this->properties = [...$this->properties, ...$properties];

        return $this;
    }

    public function describe(string $description): static
    {
        $this->description = $description;

        return $this;
    }

    public function log(string $event): ActivityLog
    {
        return ActivityLog::query()->create([
            'user_id' => $this->resolveUserId(),
            'subject_type' => $this->subject?->getMorphClass(),
            'subject_id' => $this->subject?->getKey(),
            'event' => $event,
            'description' => $this->description,
            'properties' => $this->properties === [] ? null : $this->properties,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);
    }

    private function resolveUserId(): ?int
    {
        if ($this->causer instanceof Authenticatable) {
            /** @var int|string $id */
            $id = $this->causer->getAuthIdentifier();

            return (int) $id;
        }

        if (is_int($this->causer)) {
            return $this->causer;
        }

        $authId = auth()->id();

        return $authId === null ? null : (int) $authId;
    }
}
