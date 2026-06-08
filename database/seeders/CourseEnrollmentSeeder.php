<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\CourseEnrollment;
use App\Models\User;
use Illuminate\Database\Seeder;

class CourseEnrollmentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get some sample users and courses
        $users = User::take(4)->get();
        $courses = Course::take(3)->get();

        if ($users->isEmpty() || $courses->isEmpty()) {
            $this->command->warn('No users or courses found. Please run user and course seeders first.');
            return;
        }

        // Create some sample enrollments
        $enrollmentData = [
            [
                'user_id' => $users[0]->id,
                'course_id' => $courses[0]->id,
                'progress' => 75,
                'status' => 'active',
                'enrolled_at' => now()->subDays(30),
            ],
            [
                'user_id' => $users[1]->id,
                'course_id' => $courses[0]->id,
                'progress' => 100,
                'status' => 'completed',
                'enrolled_at' => now()->subDays(45),
                'completed_at' => now()->subDays(5),
            ],
            [
                'user_id' => $users[2]->id,
                'course_id' => $courses[0]->id,
                'progress' => 45,
                'status' => 'active',
                'enrolled_at' => now()->subDays(15),
            ],
            [
                'user_id' => $users[0]->id,
                'course_id' => $courses[1]->id,
                'progress' => 30,
                'status' => 'active',
                'enrolled_at' => now()->subDays(20),
            ],
        ];

        if (isset($users[3]) && isset($courses[1])) {
            $enrollmentData[] = [
                'user_id' => $users[3]->id,
                'course_id' => $courses[1]->id,
                'progress' => 90,
                'status' => 'active',
                'enrolled_at' => now()->subDays(25),
            ];
        }

        foreach ($enrollmentData as $data) {
            try {
                CourseEnrollment::create($data);
            } catch (\Exception $e) {
                // Skip duplicates
                continue;
            }
        }

        $this->command->info('Course enrollments seeded successfully!');
    }
}
