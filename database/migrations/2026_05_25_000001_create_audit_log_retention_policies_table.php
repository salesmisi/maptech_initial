<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_log_retention_policies', function (Blueprint $table) {
            $table->id();
            $table->boolean('enabled')->default(false);
            $table->unsignedSmallInteger('retention_value')->default(365);
            $table->string('retention_unit', 16)->default('days');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_log_retention_policies');
    }
};