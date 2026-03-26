<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('time_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            // Use timestamptz on Postgres for timezone-aware timestamps
            $table->timestampTz('time_in')->nullable();
            $table->timestampTz('time_out')->nullable();
            $table->string('note')->nullable();
            // timestampsTz creates created_at and updated_at as timestamptz
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $table->timestampsTz();
            } else {
                $table->timestamps();
            }

            $table->index('user_id');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    public function down()
    {
        Schema::dropIfExists('time_logs');
    }
};
