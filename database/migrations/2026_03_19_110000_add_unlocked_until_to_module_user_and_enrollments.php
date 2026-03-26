<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        if (Schema::hasTable('module_user')) {
            Schema::table('module_user', function (Blueprint $table) {
                if (!Schema::hasColumn('module_user', 'unlocked_until')) {
                    $table->timestamp('unlocked_until')->nullable()->after('unlocked_at');
                }
            });
        }

        if (Schema::hasTable('enrollments')) {
            Schema::table('enrollments', function (Blueprint $table) {
                if (!Schema::hasColumn('enrollments', 'unlocked_until')) {
                    $table->timestamp('unlocked_until')->nullable()->after('locked');
                }
            });
        }
    }

    public function down()
    {
        if (Schema::hasTable('module_user')) {
            Schema::table('module_user', function (Blueprint $table) {
                if (Schema::hasColumn('module_user', 'unlocked_until')) {
                    $table->dropColumn('unlocked_until');
                }
            });
        }

        if (Schema::hasTable('enrollments')) {
            Schema::table('enrollments', function (Blueprint $table) {
                if (Schema::hasColumn('enrollments', 'unlocked_until')) {
                    $table->dropColumn('unlocked_until');
                }
            });
        }
    }
};
