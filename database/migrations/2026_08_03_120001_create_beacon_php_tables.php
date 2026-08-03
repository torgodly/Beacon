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
        Schema::create('php_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('server_id')->constrained()->cascadeOnDelete();
            $table->string('version', 8);
            $table->string('status', 32)->default('pending');
            $table->boolean('is_default')->default(false);
            $table->timestamp('installed_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->unique(['server_id', 'version']);
        });

        Schema::create('php_extensions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('php_version_id')->constrained()->cascadeOnDelete();
            $table->string('name', 32);
            $table->string('label')->nullable();
            $table->string('apt_package')->nullable();
            $table->boolean('is_installed')->default(false);
            $table->boolean('is_enabled')->default(false);
            $table->boolean('is_core')->default(false);
            $table->timestamp('last_synced_at')->nullable();

            $table->unique(['php_version_id', 'name']);
        });

        Schema::create('php_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('php_version_id')->constrained()->cascadeOnDelete();
            $table->string('sapi', 8);
            $table->string('key');
            $table->text('value');
            $table->timestamps();

            $table->unique(['php_version_id', 'sapi', 'key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('php_settings');
        Schema::dropIfExists('php_extensions');
        Schema::dropIfExists('php_versions');
    }
};
