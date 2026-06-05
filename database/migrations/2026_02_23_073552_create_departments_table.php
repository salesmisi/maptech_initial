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
        Schema::create('departments', function (Blueprint $table) {
            $table->id();

            $table->string('name');                    // Department Name
            $table->string('code')->unique();          // Unique Department Code
            $table->string('head')->nullable();        // Department Head (optional)
            $table->string('status')->default('Active'); // Active / Inactive
            $table->text('description')->nullable();   // Optional description

            $table->unsignedInteger('employee_count')->default(0);
            $table->unsignedInteger('course_count')->default(0);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('departments');
    }
};