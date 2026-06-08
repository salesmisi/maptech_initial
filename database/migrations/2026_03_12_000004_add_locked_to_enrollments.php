<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('enrollments')) return;
        if (!Schema::hasColumn('enrollments', 'locked')) {
            Schema::table('enrollments', function (Blueprint $table) {
                $table->boolean('locked')->default(false)->after('progress');
            });
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('enrollments')) return;
        if (Schema::hasColumn('enrollments', 'locked')) {
            Schema::table('enrollments', function (Blueprint $table) {
                $table->dropColumn('locked');
            });
        }
    }
};
