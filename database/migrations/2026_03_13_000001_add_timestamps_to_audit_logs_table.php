<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('audit_logs', 'created_at')) {
                $table->timestamp('created_at')->nullable()->after('ip_address');
            }
            if (!Schema::hasColumn('audit_logs', 'updated_at')) {
                $table->timestamp('updated_at')->nullable()->after('created_at');
            }
        });
    }

    public function down()
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $columns = [];
            if (Schema::hasColumn('audit_logs', 'created_at')) {
                $columns[] = 'created_at';
            }
            if (Schema::hasColumn('audit_logs', 'updated_at')) {
                $columns[] = 'updated_at';
            }
            if (!empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }
};
