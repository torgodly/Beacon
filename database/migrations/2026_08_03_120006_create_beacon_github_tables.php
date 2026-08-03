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
        Schema::create('github_installations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('app_id');
            $table->string('app_slug');
            $table->string('client_id');
            $table->text('client_secret');
            $table->text('private_key');
            $table->text('webhook_secret');
            $table->unsignedBigInteger('installation_id')->nullable();
            $table->string('account_login')->nullable();
            $table->string('account_type', 32)->nullable();
            $table->json('permissions')->nullable();
            $table->string('webhook_url')->nullable();
            $table->boolean('webhook_reachable')->default(false);
            $table->timestamp('last_delivery_at')->nullable();
            $table->unsignedSmallInteger('last_delivery_status')->nullable();
            $table->timestamp('connected_at')->nullable();
            $table->timestamps();
        });

        Schema::table('sites', function (Blueprint $table) {
            $table->foreign('github_installation_id')
                ->references('id')
                ->on('github_installations')
                ->nullOnDelete();
        });

        Schema::create('webhook_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('github_installation_id')->constrained()->cascadeOnDelete();
            $table->string('delivery_id');
            $table->string('event');
            $table->string('repository')->nullable();
            $table->unsignedSmallInteger('status_code')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamp('redelivered_at')->nullable();
            $table->string('payload_digest', 64);
            $table->timestamp('created_at')->nullable();

            $table->index(['github_installation_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('webhook_deliveries');

        Schema::table('sites', function (Blueprint $table) {
            $table->dropForeign(['github_installation_id']);
        });

        Schema::dropIfExists('github_installations');
    }
};
