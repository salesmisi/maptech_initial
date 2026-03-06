<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            // Link quiz to a specific module (nullable for backwards compatibility)
            $table->unsignedBigInteger('module_id')->nullable()->after('course_id');
            $table->foreign('module_id')->references('id')->on('modules')->onDelete('set null');

            // Minimum passing score (percentage 0–100), default 80%
            $table->unsignedTinyInteger('pass_percentage')->default(80)->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            $table->dropForeign(['module_id']);
            $table->dropColumn(['module_id', 'pass_percentage']);
        });
    }
};
