<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up() {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->timestampTz('created_at')->nullable()->change();
        });
    }
    public function down() {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->timestamp('created_at')->nullable()->change();
        });
    }
};
