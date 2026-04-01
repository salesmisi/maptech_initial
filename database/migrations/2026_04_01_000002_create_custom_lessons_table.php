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
        Schema::create('custom_lessons', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('custom_module_id');
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('content_type', ['text', 'video', 'file', 'link', 'quiz'])->default('text');
            $table->longText('text_content')->nullable();
            $table->string('content_path')->nullable();
            $table->string('content_url')->nullable();
            $table->string('file_name')->nullable();
            $table->string('file_type')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->unsignedInteger('duration')->nullable(); // Duration in seconds for videos
            $table->unsignedBigInteger('quiz_id')->nullable();
            $table->unsignedInteger('order')->default(0);
            $table->enum('status', ['draft', 'published'])->default('draft');
            $table->timestamps();

            $table->foreign('custom_module_id')->references('id')->on('custom_modules')->onDelete('cascade');
            $table->foreign('quiz_id')->references('id')->on('quizzes')->onDelete('set null');

            $table->index(['custom_module_id', 'order']);
            $table->index(['content_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('custom_lessons');
    }
};
