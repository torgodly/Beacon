<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

#[Signature('beacon:backup {--output= : Directory to write the backup archive into}')]
#[Description('Back up the panel SQLite database and panel .env snapshot')]
class BackupCommand extends Command
{
    public function handle(): int
    {
        $outputDirectory = $this->option('output')
            ?: storage_path('app/backups/'.now()->format('Y-m-d-His'));

        File::ensureDirectoryExists($outputDirectory);

        $databasePath = database_path('database.sqlite');
        if (File::exists($databasePath)) {
            File::copy($databasePath, $outputDirectory.'/beacon.sqlite');
            $this->components->info("Copied database to {$outputDirectory}/beacon.sqlite");
        } else {
            $this->components->warn('SQLite database file not found — skipped database copy.');
        }

        $envCandidates = [
            rtrim((string) config('beacon.paths.panel_shared'), '/').'/.env',
            base_path('.env'),
        ];

        foreach ($envCandidates as $path) {
            if (is_readable($path)) {
                File::copy($path, $outputDirectory.'/panel.env');
                $this->components->info("Copied environment file from {$path}");
                break;
            }
        }

        if (! File::exists($outputDirectory.'/panel.env')) {
            $this->components->warn('Panel .env was not readable — only the database was backed up.');
        }

        $this->components->info("Backup written to {$outputDirectory}");

        return self::SUCCESS;
    }
}
