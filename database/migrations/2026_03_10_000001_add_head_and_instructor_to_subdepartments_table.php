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
        Schema::table('subdepartments', function (Blueprint $table) {
            // Subdepartment head (similar to department head)
            $table->foreignId('head_id')
                  ->nullable()
                  ->constrained('users')
                  ->onDelete('set null');

            // Subdepartment instructor (separate from head)
            $table->foreignId('instructor_id')
                  ->nullable()
                  ->constrained('users')
                  ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subdepartments', function (Blueprint $table) {
            $table->dropForeign(['head_id']);
            $table->dropForeign(['instructor_id']);
            $table->dropColumn(['head_id', 'instructor_id']);
        });
    }
};
