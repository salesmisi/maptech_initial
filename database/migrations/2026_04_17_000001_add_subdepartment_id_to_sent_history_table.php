<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sent_history', function (Blueprint $table) {
            $table->foreignId('subdepartment_id')
                ->nullable()
                ->after('department_id')
                ->constrained('subdepartments')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sent_history', function (Blueprint $table) {
            $table->dropForeign(['subdepartment_id']);
            $table->dropColumn('subdepartment_id');
        });
    }
};
