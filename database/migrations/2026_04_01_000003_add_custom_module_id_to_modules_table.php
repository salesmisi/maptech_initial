<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Links existing course modules to custom modules for auto-sync.
     */
    public function up(): void
    {
        Schema::table('modules', function (Blueprint $table) {
            $table->unsignedBigInteger('custom_module_id')->nullable()->after('id');
            $table->foreign('custom_module_id')->references('id')->on('custom_modules')->onDelete('set null');
            $table->index(['custom_module_id']);
        });

        Schema::table('lessons', function (Blueprint $table) {
            $table->unsignedBigInteger('custom_lesson_id')->nullable()->after('id');
            $table->foreign('custom_lesson_id')->references('id')->on('custom_lessons')->onDelete('set null');
            $table->index(['custom_lesson_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lessons', function (Blueprint $table) {
            $table->dropForeign(['custom_lesson_id']);
            $table->dropColumn('custom_lesson_id');
        });

        Schema::table('modules', function (Blueprint $table) {
            $table->dropForeign(['custom_module_id']);
            $table->dropColumn('custom_module_id');
        });
    }
};
