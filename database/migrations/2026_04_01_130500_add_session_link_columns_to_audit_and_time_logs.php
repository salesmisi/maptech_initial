<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('audit_logs', 'session_key')) {
            Schema::table('audit_logs', function (Blueprint $table) {
                $table->string('session_key', 128)->nullable()->index()->after('ip_address');
            });
        }

        Schema::table('time_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('time_logs', 'session_key')) {
                $table->string('session_key', 128)->nullable()->index()->after('user_id');
            }

            if (!Schema::hasColumn('time_logs', 'login_audit_log_id')) {
                $table->unsignedBigInteger('login_audit_log_id')->nullable()->index()->after('session_key');
                $table->foreign('login_audit_log_id')->references('id')->on('audit_logs')->nullOnDelete();
            }

            if (!Schema::hasColumn('time_logs', 'logout_audit_log_id')) {
                $table->unsignedBigInteger('logout_audit_log_id')->nullable()->index()->after('login_audit_log_id');
                $table->foreign('logout_audit_log_id')->references('id')->on('audit_logs')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('time_logs', function (Blueprint $table) {
            if (Schema::hasColumn('time_logs', 'logout_audit_log_id')) {
                $table->dropConstrainedForeignId('logout_audit_log_id');
            }
            if (Schema::hasColumn('time_logs', 'login_audit_log_id')) {
                $table->dropConstrainedForeignId('login_audit_log_id');
            }
            if (Schema::hasColumn('time_logs', 'session_key')) {
                $table->dropColumn('session_key');
            }
        });

        if (Schema::hasColumn('audit_logs', 'session_key')) {
            Schema::table('audit_logs', function (Blueprint $table) {
                $table->dropColumn('session_key');
            });
        }
    }
};
