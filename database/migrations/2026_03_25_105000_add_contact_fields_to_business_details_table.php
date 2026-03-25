<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('business_details', function (Blueprint $table) {
            $table->string('email')->nullable()->after('logo_path');
            $table->string('phone')->nullable()->after('email');
            $table->string('country')->nullable()->after('phone');
            $table->string('address')->nullable()->after('country');
            $table->string('website')->nullable()->after('address');
        });
    }

    public function down(): void
    {
        Schema::table('business_details', function (Blueprint $table) {
            $table->dropColumn(['email', 'phone', 'country', 'address', 'website']);
        });
    }
};
