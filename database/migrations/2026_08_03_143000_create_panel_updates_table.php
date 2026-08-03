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
        Schema::create('panel_updates', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('action', 16);
            $table->string('tag', 32)->nullable();
            $table->string('status', 32)->default('queued');
            $table->string('log_path');
            $table->text('error')->nullable();
            $table->unsignedSmallInteger('exit_code')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('panel_updates');
    }
};
