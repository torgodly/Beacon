<?php

namespace App\Services\Database;

use App\Models\Database;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use RuntimeException;

class MySqlRemoteAccessService
{
    public function __construct(private readonly ProcessRunner $runner) {}

    public function sync(): void
    {
        $enabled = Database::query()->where('allow_remote', true)->exists();

        $result = $this->runner->sudoRoot(
            SudoWrapper::MySql,
            ['remote-access', $enabled ? 'enabled' : 'disabled'],
            timeout: 120,
        );

        if ($result->failed()) {
            throw new RuntimeException(
                trim($result->errorOutput()) ?: 'Could not update MySQL remote access.',
            );
        }
    }
}
