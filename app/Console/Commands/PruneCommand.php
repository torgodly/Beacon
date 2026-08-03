<?php

namespace App\Console\Commands;

use App\Models\DatabaseBackup;
use App\Models\Deployment;
use App\Models\PanelUpdate;
use App\Models\ServerMetric;
use App\Models\SiteCommand;
use App\Models\WebhookDelivery;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

#[Signature('beacon:prune')]
#[Description('Prune old metrics, logs, deliveries, and expired backups')]
class PruneCommand extends Command
{
    public function handle(): int
    {
        $metrics = ServerMetric::query()
            ->where('recorded_at', '<', now()->subDays((int) config('beacon.retention.metrics_days', 30)))
            ->delete();

        $deployments = Deployment::query()
            ->where('created_at', '<', now()->subDays((int) config('beacon.retention.deployments_days', 90)))
            ->get();

        $deploymentCount = 0;
        foreach ($deployments as $deployment) {
            if ($deployment->log_path && File::exists($deployment->log_path)) {
                File::delete($deployment->log_path);
            }
            $deployment->delete();
            $deploymentCount++;
        }

        $commands = SiteCommand::query()
            ->where('created_at', '<', now()->subDays((int) config('beacon.retention.commands_days', 30)))
            ->get();

        $commandCount = 0;
        foreach ($commands as $command) {
            if ($command->log_path && File::exists($command->log_path)) {
                File::delete($command->log_path);
            }
            $command->delete();
            $commandCount++;
        }

        $deliveries = WebhookDelivery::query()
            ->where('created_at', '<', now()->subDays((int) config('beacon.retention.deliveries_days', 14)))
            ->delete();

        $backups = DatabaseBackup::query()
            ->where(function ($query): void {
                $query->where('expires_at', '<', now())
                    ->orWhere('created_at', '<', now()->subDays(90));
            })
            ->get();

        $backupCount = 0;
        foreach ($backups as $backup) {
            if (File::exists($backup->path)) {
                File::delete($backup->path);
            }
            $backup->delete();
            $backupCount++;
        }

        $updates = PanelUpdate::query()
            ->where('created_at', '<', now()->subDays((int) config('beacon.retention.panel_updates_days', 90)))
            ->get();

        $updateCount = 0;
        foreach ($updates as $update) {
            if (File::exists($update->log_path)) {
                File::delete($update->log_path);
            }
            $update->delete();
            $updateCount++;
        }

        $this->components->info("Pruned {$metrics} metrics, {$deploymentCount} deployments, {$commandCount} console runs, {$deliveries} webhook deliveries, {$backupCount} database backups, and {$updateCount} panel updates.");

        return self::SUCCESS;
    }
}
