<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Rename 'name' to 'fullname' if it exists
            if (Schema::hasColumn('users', 'name') && !Schema::hasColumn('users', 'fullname')) {
                $table->renameColumn('name', 'fullname');
            }

            // Add department (nullable, required for Employee)
            if (!Schema::hasColumn('users', 'department')) {
                $table->string('department')->nullable()->after('role');
            }

            // Add status (Active | Inactive)
            if (!Schema::hasColumn('users', 'status')) {
                $table->enum('status', ['Active', 'Inactive'])->default('Active')->after('department');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'fullName')) {
                $table->renameColumn('fullName', 'name');
            }
            $table->dropColumn(['department', 'status']);
        });
    }
};
