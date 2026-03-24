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
        Schema::create('product_logos', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('file_path'); // storage path or URL for the logo image
            $table->unsignedBigInteger('module_id')->nullable();
            $table->unsignedBigInteger('lesson_id')->nullable();
            $table->timestamps();

            $table->foreign('module_id')->references('id')->on('modules')->onDelete('set null');
            $table->foreign('lesson_id')->references('id')->on('lessons')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('product_logos', function (Blueprint $table) {
            $table->dropForeign(['module_id']);
            $table->dropForeign(['lesson_id']);
        });

        Schema::dropIfExists('product_logos');
    }
};
