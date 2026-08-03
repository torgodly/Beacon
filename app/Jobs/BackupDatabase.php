<?php

namespace App\Jobs;

use App\Models\DatabaseBackup;
use App\Services\Database\DatabaseBackupService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class BackupDatabase implements ShouldQueue
{
    use Queueable;

    public int $timeout = 700;

    public function __construct(public DatabaseBackup $backup) {}

    public function handle(DatabaseBackupService $backups): void
    {
        $backups->run($this->backup);
    }
}
