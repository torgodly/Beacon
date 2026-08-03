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
        Schema::create('databases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('server_id')->constrained()->cascadeOnDelete();
            $table->string('name')->unique();
            $table->string('charset', 32)->default('utf8mb4');
            $table->string('collation', 64)->default('utf8mb4_unicode_ci');
            $table->string('status', 32)->default('active');
            $table->timestamps();
        });

        Schema::create('database_users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('server_id')->constrained()->cascadeOnDelete();
            $table->string('username');
            $table->text('password');
            $table->string('host', 255)->default('localhost');
            $table->string('status', 32)->default('active');
            $table->timestamps();

            $table->unique(['username', 'host']);
        });

        Schema::create('database_user_database', function (Blueprint $table) {
            $table->foreignId('database_id')->constrained()->cascadeOnDelete();
            $table->foreignId('database_user_id')->constrained()->cascadeOnDelete();
            $table->string('privileges', 32)->default('all');
            $table->json('custom_grants')->nullable();

            $table->primary(['database_id', 'database_user_id']);
        });

        Schema::create('database_backups', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('database_id')->constrained()->cascadeOnDelete();
            $table->string('filename');
            $table->string('path');
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->string('status', 32)->default('queued');
            $table->text('error')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('database_backups');
        Schema::dropIfExists('database_user_database');
        Schema::dropIfExists('database_users');
        Schema::dropIfExists('databases');
    }
};
