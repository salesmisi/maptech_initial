<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fix the OTP column size to accommodate hashed values.
 *
 * The OTP is hashed with bcrypt which produces 60-character strings,
 * but the column was originally defined as varchar(6).
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('password_reset_tokens', function (Blueprint $table) {
            // Change OTP column from varchar(6) to varchar(255) to store hashed values
            $table->string('otp', 255)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('password_reset_tokens', function (Blueprint $table) {
            $table->string('otp', 6)->nullable()->change();
        });
    }
};
