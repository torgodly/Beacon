<?php

namespace App\Services\System;

/**
 * The fixed set of root wrappers installed at `{beacon.paths.bin}/beacon-*`.
 *
 * `beacon-panel`'s sudoers file grants exactly these absolute paths — no
 * wildcards. `Run` and `Fs` are the exception: sudoers grants them via
 * `sudo -u beacon` (unprivileged runas), never `(root)`.
 */
enum SudoWrapper: string
{
    case Nginx = 'nginx';
    case Php = 'php';
    case Supervisor = 'supervisor';
    case Certbot = 'certbot';
    case Service = 'service';
    case Package = 'pkg';
    case Cron = 'cron';
    case Update = 'update';
    case Run = 'run';
    case Fs = 'fs';

    /**
     * Absolute path to this wrapper, e.g. `/opt/beacon/bin/beacon-nginx`.
     */
    public function path(): string
    {
        return rtrim((string) config('beacon.paths.bin'), '/')."/beacon-{$this->value}";
    }
}
