<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('business_details', function (Blueprint $table) {
            $table->id();
            $table->string('company_name')->default('Maptech Information Solutions Inc.');
            $table->string('logo_path')->default('/assets/Maptech-Official-Logo.png');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_details');
    }
};
