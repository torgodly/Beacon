<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Support\ActivityEventLabel;
use Inertia\Inertia;
use Inertia\Response;

class ActivityController extends Controller
{
    public function index(): Response
    {
        $logs = ActivityLog::query()
            ->with(['user:id,name,email'])
            ->latest('id')
            ->limit(100)
            ->get()
            ->map(fn (ActivityLog $log): array => $this->payload($log));

        return Inertia::render('activity/index', [
            'logs' => $logs,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(ActivityLog $log): array
    {
        $meta = ActivityEventLabel::for($log->event);

        return [
            'id' => $log->id,
            'event' => $log->event,
            'label' => $meta['label'],
            'tone' => $meta['tone'],
            'description' => $log->description,
            'properties' => $log->properties,
            'user' => $log->user ? [
                'name' => $log->user->name,
                'email' => $log->user->email,
            ] : null,
            'subject_type' => $log->subject_type,
            'subject_id' => $log->subject_id,
            'created_at' => $log->created_at?->toIso8601String(),
        ];
    }
}
