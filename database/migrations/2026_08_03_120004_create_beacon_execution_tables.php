<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('deployments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('site_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('trigger', 16);
            $table->string('status', 32)->default('queued');
            $table->string('branch')->nullable();
            $table->string('commit_sha', 64)->nullable();
            $table->text('commit_message')->nullable();
            $table->string('commit_author')->nullable();
            $table->string('commit_url')->nullable();
            $table->unsignedBigInteger('github_deployment_id')->nullable();
            $table->string('log_path');
            $table->text('output')->nullable();
            $table->integer('exit_code')->nullable();
            $table->string('failed_step')->nullable();
            $table->unsignedInteger('peak_memory_mb')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamps();

            $table->index(['site_id', 'created_at']);
        });

        Schema::table('sites', function (Blueprint $table) {
            $table->foreign('last_deployment_id')
                ->references('id')
                ->on('deployments')
                ->nullOnDelete();
        });

        Schema::create('commands', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('site_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('command');
            $table->string('status', 32)->default('queued');
            $table->integer('exit_code')->nullable();
            $table->string('log_path');
            $table->text('output')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });

        Schema::create('supervisor_processes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('site_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('program_name')->unique();
            $table->string('kind', 32);
            $table->text('command');
            $table->string('directory');
            $table->string('run_as')->default('beacon');
            $table->unsignedSmallInteger('numprocs')->default(1);
            $table->boolean('autostart')->default(true);
            $table->boolean('autorestart')->default(true);
            $table->unsignedInteger('stop_wait_secs')->default(3600);
            $table->string('stop_signal', 16)->default('TERM');
            $table->json('environment')->nullable();
            $table->string('connection')->nullable();
            $table->string('queue')->nullable();
            $table->unsignedSmallInteger('tries')->nullable();
            $table->unsignedInteger('job_timeout')->nullable();
            $table->unsignedSmallInteger('sleep')->nullable();
            $table->unsignedInteger('max_time')->nullable();
            $table->unsignedSmallInteger('backoff')->nullable();
            $table->unsignedSmallInteger('rest')->nullable();
            $table->string('config_path')->nullable();
            $table->string('log_path')->nullable();
            $table->string('status', 32)->default('stopped');
            $table->text('status_message')->nullable();
            $table->timestamp('last_status_at')->nullable();
            $table->boolean('is_system')->default(false);
            $table->timestamps();
        });

        Schema::create('cron_jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('server_id')->constrained()->cascadeOnDelete();
            $table->foreignId('site_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('command');
            $table->string('run_as')->default('beacon');
            $table->string('expression');
            $table->string('frequency_preset', 32)->nullable();
            $table->boolean('is_laravel_scheduler')->default(false);
            $table->string('output_redirect')->nullable();
            $table->boolean('enabled')->default(true);
            $table->boolean('is_system')->default(false);
            $table->timestamp('last_ran_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cron_jobs');
        Schema::dropIfExists('supervisor_processes');
        Schema::dropIfExists('commands');
        Schema::table('sites', function (Blueprint $table) {
            $table->dropForeign(['last_deployment_id']);
        });
        Schema::dropIfExists('deployments');
    }
};
