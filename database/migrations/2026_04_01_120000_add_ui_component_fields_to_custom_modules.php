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
        Schema::table('custom_modules', function (Blueprint $table) {
            // Module type: 'learning' for course modules, 'ui_component' for sidebar UI modules
            $table->enum('module_type', ['learning', 'ui_component'])->default('learning')->after('title');

            // For UI component modules
            $table->string('route_path')->nullable()->after('module_type');
            $table->string('icon_name')->nullable()->after('route_path');
            $table->json('component_config')->nullable()->after('icon_name');

            // Add index for efficient querying
            $table->index(['module_type', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('custom_modules', function (Blueprint $table) {
            $table->dropIndex(['module_type', 'status']);
            $table->dropColumn(['module_type', 'route_path', 'icon_name', 'component_config']);
        });
    }
};
