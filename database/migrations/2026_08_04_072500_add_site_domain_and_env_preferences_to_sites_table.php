<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->boolean('env_cache_on_save')->default(false)->after('app_env');
            $table->boolean('allow_wildcard_subdomains')->default(false)->after('env_cache_on_save');
        });
    }

    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn(['env_cache_on_save', 'allow_wildcard_subdomains']);
        });
    }
};
