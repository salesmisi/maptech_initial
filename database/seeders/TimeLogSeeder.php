<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\TimeLog;
use App\Models\User;
use App\Events\TimeLogUpdated;
use Carbon\Carbon;

class TimeLogSeeder extends Seeder
{
    public function run()
    {
        $user = User::first();
        if (! $user) {
            $this->command->info('No users found; skipping TimeLog seeder.');
            return;
        }

        $tl = TimeLog::create([
            'user_id' => $user->id,
            'time_in' => Carbon::now(),
            'time_out' => null,
            'note' => 'Seeded time log',
        ]);

        event(new TimeLogUpdated($tl));
        $this->command->info('Seeded time log and dispatched TimeLogUpdated event.');
    }
}
