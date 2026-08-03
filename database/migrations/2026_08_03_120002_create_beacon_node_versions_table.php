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
        Schema::create('node_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('server_id')->constrained()->cascadeOnDelete();
            $table->string('runtime', 8);
            $table->string('version', 16);
            $table->string('path');
            $table->boolean('is_default')->default(false);
            $table->string('status', 32)->default('installed');
            $table->timestamps();

            $table->unique(['server_id', 'runtime', 'version']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('node_versions');
    }
};
