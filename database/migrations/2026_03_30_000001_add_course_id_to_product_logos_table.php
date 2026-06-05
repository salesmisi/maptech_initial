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
        if (!Schema::hasTable('product_logos')) {
            return;
        }

        if (!Schema::hasColumn('product_logos', 'course_id')) {
            Schema::table('product_logos', function (Blueprint $table) {
                $table->uuid('course_id')->nullable()->after('file_path');
                $table->index('course_id');
                $table->foreign('course_id')->references('id')->on('courses')->onDelete('set null');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('product_logos')) {
            return;
        }

        if (Schema::hasColumn('product_logos', 'course_id')) {
            Schema::table('product_logos', function (Blueprint $table) {
                $table->dropForeign(['course_id']);
                $table->dropIndex(['course_id']);
                $table->dropColumn('course_id');
            });
        }
    }
};
