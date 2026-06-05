<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sent_history', function (Blueprint $table) {
            $table->json('data')
                ->nullable()
                ->after('announcement_mode');
        });
    }

    public function down(): void
    {
        Schema::table('sent_history', function (Blueprint $table) {
            $table->dropColumn('data');
        });
    }
};
