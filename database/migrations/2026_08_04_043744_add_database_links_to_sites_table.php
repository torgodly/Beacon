<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->foreignId('database_id')
                ->nullable()
                ->after('php_version')
                ->constrained('databases')
                ->nullOnDelete();
            $table->foreignId('database_user_id')
                ->nullable()
                ->after('database_id')
                ->constrained('database_users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->dropConstrainedForeignId('database_user_id');
            $table->dropConstrainedForeignId('database_id');
        });
    }
};
