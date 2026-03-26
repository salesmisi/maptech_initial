<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Module;
use App\Models\User;
use Illuminate\Support\Facades\DB;

$uid = $argv[1] ?? 1;
$mid = $argv[2] ?? null;
$mins = isset($argv[3]) ? (int)$argv[3] : 60;

$user = User::find($uid);
if (!$user) { echo json_encode(['error'=>'user not found']).PHP_EOL; exit(1);}

$enrollment = Enrollment::where('user_id', $user->id)->first();
if (!$enrollment) { echo json_encode(['error'=>'user not enrolled']).PHP_EOL; exit(1);}

$course = Course::with(['modules'=>fn($q)=>$q->with('lessons')->orderBy('order')])->find($enrollment->course_id);
if (!$course) { echo json_encode(['error'=>'course not found']).PHP_EOL; exit(1);}

if (!$mid) {
    $mod = $course->modules->first();
    if (!$mod) { echo json_encode(['error'=>'no modules']).PHP_EOL; exit(1);}
    $mid = $mod->id;
}

$until = now()->addMinutes($mins);
DB::table('module_user')->updateOrInsert(
    ['module_id' => $mid, 'user_id' => $user->id],
    ['unlocked' => true, 'unlocked_at' => now(), 'unlocked_until' => $until, 'updated_at' => now(), 'created_at' => now()]
);

// fetch course payload similar to employee controller
$moduleIds = $course->modules->pluck('id');
$manualUnlockedModuleIds = DB::table('module_user')
    ->where('user_id', $user->id)
    ->whereIn('module_id', $moduleIds)
    ->where('unlocked', true)
    ->where(function($q){ $q->whereNull('unlocked_until')->orWhere('unlocked_until', '>', now()); })
    ->pluck('module_id')
    ->map(fn($id)=> (string)$id)
    ->toArray();

$modules = $course->modules->map(function($m) use ($manualUnlockedModuleIds){
    return [
        'id'=>$m->id,
        'title'=>$m->title,
        'is_unlocked' => in_array((string)$m->id, $manualUnlockedModuleIds, true),
    ];
});

echo json_encode(['manual_unlocked_module_ids'=>$manualUnlockedModuleIds, 'modules'=>$modules], JSON_PRETTY_PRINT) . PHP_EOL;
