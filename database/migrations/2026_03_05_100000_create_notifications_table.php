<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->uuid('course_id')->nullable();
            $table->unsignedBigInteger('module_id')->nullable();
            $table->string('type')->default('quiz'); // quiz, announcement, etc.
            $table->string('title');
            $table->text('message')->nullable();
            $table->json('data')->nullable(); // extra payload (quiz questions, etc.)
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->foreign('course_id')->references('id')->on('courses')->onDelete('cascade');
            $table->foreign('module_id')->references('id')->on('modules')->onDelete('cascade');
            $table->index(['user_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
