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
        Schema::create('servers', function (Blueprint $table) {
            $table->id();
            $table->string('hostname');
            $table->string('public_ip', 45);
            $table->string('private_ip', 45)->nullable();
            $table->string('os_release');
            $table->string('beacon_version')->nullable();
            $table->string('timezone')->default('UTC');
            $table->string('panel_domain')->nullable();
            $table->unsignedSmallInteger('panel_port')->default(8443);
            $table->boolean('panel_url_public')->default(false);
            $table->string('wildcard_domain')->nullable();
            $table->string('default_php_version', 8)->default('8.4');
            $table->string('default_node_version', 16)->default('22');
            $table->string('default_package_manager', 16)->default('npm');
            $table->unsignedInteger('total_memory_mb')->nullable();
            $table->unsignedInteger('swap_mb')->nullable();
            $table->json('settings')->nullable();
            $table->timestamp('provisioned_at')->nullable();
            $table->timestamps();
        });

        Schema::create('server_metrics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('server_id')->constrained()->cascadeOnDelete();
            $table->decimal('cpu_percent', 5, 2)->default(0);
            $table->unsignedInteger('memory_used_mb')->default(0);
            $table->unsignedInteger('memory_total_mb')->default(0);
            $table->unsignedInteger('swap_used_mb')->default(0);
            $table->unsignedInteger('disk_used_mb')->default(0);
            $table->unsignedInteger('disk_total_mb')->default(0);
            $table->decimal('load_1', 8, 2)->default(0);
            $table->decimal('load_5', 8, 2)->default(0);
            $table->decimal('load_15', 8, 2)->default(0);
            $table->unsignedBigInteger('uptime_seconds')->default(0);
            $table->timestamp('recorded_at');

            $table->index(['server_id', 'recorded_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('server_metrics');
        Schema::dropIfExists('servers');
    }
};
