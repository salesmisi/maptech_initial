<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Course;
use App\Models\Module;
use App\Models\Lesson;

class YouTubeLessonSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create or find a sample course
        $course = Course::firstOrCreate([
            'title' => 'Cyber Threats (YouTube Test)'
        ], [
            'description' => 'Sample course to test YouTube embedding',
            'department' => 'IT',
            'status' => 'Active'
        ]);

        // Create a module
        $module = Module::firstOrCreate([
            'course_id' => $course->id,
            'title' => 'Introduction to Cyber Threats'
        ], [
            'description' => 'Module for testing YouTube video lesson',
            'order' => 1,
        ]);

        // Create a lesson that points to a YouTube URL
        // Replace the URL below with any public YouTube video if you prefer
        $youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

        // Build attributes/values conditionally in case the DB schema differs
        $attrs = [
            'module_id' => $module->id,
            'title' => 'Types of Cyber Threats (YouTube)'
        ];

        $candidateValues = [
            'text_content' => 'Short sample video about cyber threats.',
            'content_path' => $youtubeUrl,
            'order' => 1,
            'status' => 'Active',
            'type' => 'Video',
        ];

        $values = [];
        foreach ($candidateValues as $col => $val) {
            if (\Illuminate\Support\Facades\Schema::hasColumn('lessons', $col)) {
                $values[$col] = $val;
            }
        }

        Lesson::firstOrCreate($attrs, $values);
    }
}
