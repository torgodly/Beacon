<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->string('app_env', 16)->default('production')->after('php_version');
            $table->string('database_driver', 16)->default('mysql')->after('database_user_id');
            $table->boolean('redis_enabled')->default(false)->after('database_driver');
        });
    }

    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn(['app_env', 'database_driver', 'redis_enabled']);
        });
    }
};
