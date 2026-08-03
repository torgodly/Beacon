<?php

namespace App\Http\Controllers\Databases;

use App\Http\Controllers\Controller;
use App\Models\Database;
use App\Models\DatabaseBackup;
use App\Models\Server;
use App\Services\Database\DatabaseBackupService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class DatabaseBackupController extends Controller
{
    public function store(Database $database, DatabaseBackupService $backups): RedirectResponse
    {
        abort_unless($database->server_id === Server::current()->id, 404);

        $backups->queue($database);

        return back()->with('toast', [
            'type' => 'success',
            'message' => 'Backup queued. It will appear below when ready.',
        ]);
    }

    public function download(Request $request, DatabaseBackup $backup): BinaryFileResponse
    {
        if (! $request->hasValidSignature()) {
            abort(403);
        }

        abort_unless($backup->status === 'success', 404);
        abort_unless(is_readable($backup->path), 404);

        return response()->download($backup->path, $backup->filename, [
            'Content-Type' => 'application/gzip',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public static function backupPayload(DatabaseBackup $backup): array
    {
        return [
            'uuid' => $backup->uuid,
            'filename' => $backup->filename,
            'status' => $backup->status,
            'size_bytes' => $backup->size_bytes,
            'error' => $backup->error,
            'started_at' => $backup->started_at?->toIso8601String(),
            'finished_at' => $backup->finished_at?->toIso8601String(),
            'download_url' => $backup->status === 'success'
                ? URL::temporarySignedRoute(
                    'database-backups.download',
                    now()->addHour(),
                    ['backup' => $backup->uuid],
                )
                : null,
        ];
    }
}
