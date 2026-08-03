<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One streamable record for every long-running action in the panel.
     *
     * Before this table, an action like "install PHP 8.4" surfaced as nothing
     * but a status word while apt ran for two minutes behind it. Operations
     * give every action a live log the operator can open, minimise, navigate
     * away from, and come back to.
     */
    public function up(): void
    {
        Schema::create('operations', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();

            // Dotted action key, e.g. php.install, ssl.issue, service.restart.
            $table->string('type', 64);
            $table->string('title');
            $table->string('summary')->nullable();

            // What the operation acts on, so the UI can deep-link back.
            $table->nullableMorphs('subject');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            $table->string('status', 16)->default('queued');
            $table->string('log_path');
            $table->unsignedSmallInteger('exit_code')->nullable();
            $table->text('error')->nullable();

            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamps();

            // The dock polls for active operations on every page.
            $table->index(['status', 'created_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operations');
    }
};
