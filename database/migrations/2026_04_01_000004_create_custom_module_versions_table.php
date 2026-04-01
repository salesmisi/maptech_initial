<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Version history for custom modules (edit history feature).
     */
    public function up(): void
    {
        Schema::create('custom_module_versions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('custom_module_id');
            $table->integer('version_number');
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('lessons_snapshot')->nullable(); // Snapshot of lessons at this version
            $table->json('changes')->nullable(); // Description of what changed
            $table->unsignedBigInteger('created_by');
            $table->timestamp('created_at');

            $table->foreign('custom_module_id')->references('id')->on('custom_modules')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');

            $table->unique(['custom_module_id', 'version_number']);
            $table->index(['custom_module_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('custom_module_versions');
    }
};
