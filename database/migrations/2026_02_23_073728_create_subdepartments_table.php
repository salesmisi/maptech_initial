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
        Schema::create('subdepartments', function (Blueprint $table) {
            $table->id();

            // Foreign key to departments table
            $table->foreignId('department_id')
                  ->constrained('departments')
                  ->onDelete('cascade');

            $table->string('name'); // Subdepartment name
            $table->text('description')->nullable(); // Optional description

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subdepartments');
    }
};