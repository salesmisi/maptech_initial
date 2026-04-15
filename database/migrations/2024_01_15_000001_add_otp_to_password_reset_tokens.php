<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration to add OTP support to password_reset_tokens table.
 *
 * This adds:
 * - `otp`: A 6-digit one-time password for email verification
 * - `expires_at`: Timestamp when the OTP/token expires (15 minutes default)
 * - `attempts`: Counter to prevent brute-force attacks (max 5 attempts)
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('password_reset_tokens', function (Blueprint $table) {
            // Add OTP column for 6-digit verification code
            $table->string('otp', 6)->nullable()->after('token');

            // Add expiration timestamp (tokens expire after 15 minutes)
            $table->timestamp('expires_at')->nullable()->after('otp');

            // Add attempt counter for brute-force protection
            $table->unsignedTinyInteger('attempts')->default(0)->after('expires_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('password_reset_tokens', function (Blueprint $table) {
            $table->dropColumn(['otp', 'expires_at', 'attempts']);
        });
    }
};
