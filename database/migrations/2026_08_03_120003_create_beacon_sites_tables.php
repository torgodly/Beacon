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
        Schema::create('sites', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('server_id')->constrained()->cascadeOnDelete();
            $table->string('name')->unique();
            $table->string('type', 32);
            $table->string('path');
            $table->string('web_directory')->default('/public');
            $table->string('system_user')->default('beacon');
            $table->string('php_version', 8)->nullable();
            $table->string('node_version', 16)->nullable();
            $table->string('package_manager', 16)->nullable();
            $table->unsignedSmallInteger('proxy_port')->nullable()->unique();
            $table->boolean('spa_fallback')->default(false);
            $table->string('client_max_body_size', 16)->default('100M');
            $table->boolean('open_basedir')->default(true);
            $table->json('open_basedir_extra_paths')->nullable();
            $table->boolean('strict_functions')->default(false);
            $table->string('repository_provider', 32)->nullable();
            $table->string('repository')->nullable();
            $table->string('repository_branch')->nullable();
            $table->unsignedBigInteger('github_installation_id')->nullable();
            $table->unsignedBigInteger('github_repo_id')->nullable();
            $table->string('deploy_key_path')->nullable();
            $table->text('deploy_key_public')->nullable();
            $table->boolean('auto_deploy')->default(false);
            $table->string('deploy_trigger', 16)->default('manual');
            $table->string('last_polled_sha', 64)->nullable();
            $table->timestamp('last_polled_at')->nullable();
            $table->text('deploy_script')->nullable();
            $table->string('deployment_status', 32)->default('idle');
            $table->timestamp('last_deployed_at')->nullable();
            $table->unsignedBigInteger('last_deployment_id')->nullable();
            $table->boolean('nginx_customized')->default(false);
            $table->string('nginx_managed_hash', 64)->nullable();
            $table->string('ssl_status', 32)->default('none');
            $table->string('status', 32)->default('active');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('site_domains', function (Blueprint $table) {
            $table->id();
            $table->foreignId('site_id')->constrained()->cascadeOnDelete();
            $table->string('domain')->unique();
            $table->boolean('is_primary')->default(false);
            $table->string('redirect_to')->nullable();
            $table->unsignedSmallInteger('redirect_status_code')->nullable();
            $table->unsignedBigInteger('ssl_certificate_id')->nullable();
            $table->timestamps();
        });

        Schema::create('ssl_certificates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('site_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 32)->default('letsencrypt');
            $table->string('lineage');
            $table->json('domains');
            $table->string('status', 32)->default('pending');
            $table->string('certificate_path')->nullable();
            $table->string('private_key_path')->nullable();
            $table->timestamp('issued_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('last_renewed_at')->nullable();
            $table->boolean('auto_renew')->default(true);
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::table('site_domains', function (Blueprint $table) {
            $table->foreign('ssl_certificate_id')
                ->references('id')
                ->on('ssl_certificates')
                ->nullOnDelete();
        });

        Schema::create('env_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('site_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->text('contents');
            $table->timestamp('created_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('env_snapshots');
        Schema::table('site_domains', function (Blueprint $table) {
            $table->dropForeign(['ssl_certificate_id']);
        });
        Schema::dropIfExists('ssl_certificates');
        Schema::dropIfExists('site_domains');
        Schema::dropIfExists('sites');
    }
};
