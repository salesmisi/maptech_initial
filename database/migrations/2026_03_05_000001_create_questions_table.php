<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Superseded by 2026_03_06_000001_create_questions_table migration
        // which uses the correct schema (course_id foreign key instead of course string)
    }

    public function down(): void
    {
        //
    }
};
