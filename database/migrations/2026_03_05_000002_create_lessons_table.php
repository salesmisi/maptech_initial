<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lessons', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('module_id');
            $table->string('title');
            $table->enum('type', ['Video', 'Document', 'Text'])->default('Video');
            $table->string('content_path')->nullable();
            $table->longText('text_content')->nullable();
            $table->string('duration')->nullable();
            $table->string('file_size')->nullable();
            $table->enum('status', ['Published', 'Draft'])->default('Draft');
            $table->integer('order')->default(0);
            $table->timestamps();

            $table->foreign('module_id')->references('id')->on('modules')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lessons');
    }
};
