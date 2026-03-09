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
            $table->dropForeign(['instructor_id']);
            $table->renameColumn('instructor_id', 'employee_id');
            $table->foreign('employee_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subdepartments', function (Blueprint $table) {
            $table->dropForeign(['employee_id']);
            $table->renameColumn('employee_id', 'instructor_id');
            $table->foreign('instructor_id')->references('id')->on('users')->nullOnDelete();
        });
    }
};
