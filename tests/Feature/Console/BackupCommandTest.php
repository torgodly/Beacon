<?php

namespace Tests\Feature\Console;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class BackupCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_a_backup_directory(): void
    {
        $outputDirectory = storage_path('framework/testing/backup-command');

        if (File::isDirectory($outputDirectory)) {
            File::deleteDirectory($outputDirectory);
        }

        $this->artisan('beacon:backup', [
            '--output' => $outputDirectory,
        ])->assertSuccessful();

        $this->assertDirectoryExists($outputDirectory);
    }
}
