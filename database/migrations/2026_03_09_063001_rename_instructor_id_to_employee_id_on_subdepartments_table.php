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
            if (Schema::hasColumn('subdepartments', 'instructor_id')) {
                // Drop existing foreign and rename only if the column exists (sqlite-safe)
                try {
                    $table->dropForeign(['instructor_id']);
                } catch (\Exception $e) {
                    // ignore if foreign doesn't exist
                }
                $table->renameColumn('instructor_id', 'employee_id');
                $table->foreign('employee_id')->references('id')->on('users')->nullOnDelete();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subdepartments', function (Blueprint $table) {
            if (Schema::hasColumn('subdepartments', 'employee_id')) {
                try {
                    $table->dropForeign(['employee_id']);
                } catch (\Exception $e) {
                    // ignore if foreign doesn't exist
                }
                $table->renameColumn('employee_id', 'instructor_id');
                $table->foreign('instructor_id')->references('id')->on('users')->nullOnDelete();
            }
        });
    }
};
