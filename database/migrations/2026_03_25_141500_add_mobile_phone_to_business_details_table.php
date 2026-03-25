<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('business_details', function (Blueprint $table) {
            if (! Schema::hasColumn('business_details', 'mobile_phone')) {
                $table->string('mobile_phone', 20)->nullable()->after('phone');
            }
        });
    }

    public function down(): void
    {
        Schema::table('business_details', function (Blueprint $table) {
            if (Schema::hasColumn('business_details', 'mobile_phone')) {
                $table->dropColumn('mobile_phone');
            }
        });
    }
};
