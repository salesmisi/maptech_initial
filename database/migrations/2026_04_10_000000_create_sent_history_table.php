<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sent_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sender_id')->constrained('users')->onDelete('cascade');
            $table->string('title');
            $table->text('message');
            $table->string('target')->default('Multiple Users'); // Description of the target audience
            $table->json('target_roles')->nullable(); // Array of roles targeted
            $table->unsignedBigInteger('department_id')->nullable();
            $table->integer('recipients_count')->default(0);
            $table->timestamp('deleted_at')->nullable(); // Soft delete for recently deleted
            $table->timestamps();

            $table->foreign('department_id')->references('id')->on('departments')->onDelete('set null');
            $table->index(['sender_id', 'deleted_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sent_history');
    }
};
