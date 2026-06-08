<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        if (!Schema::hasTable('module_user')) {
            Schema::create('module_user', function (Blueprint $table) {
                $table->unsignedBigInteger('module_id');
                $table->unsignedBigInteger('user_id');
                $table->boolean('unlocked')->default(false);
                $table->timestamp('unlocked_at')->nullable();
                $table->timestamps();

                $table->primary(['module_id', 'user_id']);
                $table->foreign('module_id')->references('id')->on('modules')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('module_user');
    }
};
