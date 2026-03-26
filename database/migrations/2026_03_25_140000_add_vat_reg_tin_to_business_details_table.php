<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('business_details', function (Blueprint $table) {
            if (! Schema::hasColumn('business_details', 'vat_reg_tin')) {
                $table->string('vat_reg_tin', 100)->nullable()->after('website');
            }
        });
    }

    public function down(): void
    {
        Schema::table('business_details', function (Blueprint $table) {
            if (Schema::hasColumn('business_details', 'vat_reg_tin')) {
                $table->dropColumn('vat_reg_tin');
            }
        });
    }
};
