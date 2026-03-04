<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Course;
use App\Models\Module;

$course = Course::where('department', 'IT')->first();
if (!$course) {
    echo "No IT course found.\n";
    exit(0);
}

$modules = [
    [
        'title' => 'Intro video - Cybersecurity',
        'content_path' => 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        'pre_assessment' => [
            [
                'id' => 1,
                'question' => 'What is the primary goal of cybersecurity?',
                'options' => ['Protect systems', 'Create vulnerabilities', 'Slow networks', 'Increase costs'],
                'answer' => 0
            ],
            [
                'id' => 2,
                'question' => 'Which one is a common attack type?',
                'options' => ['Phishing', 'Gardening', 'Painting', 'Archiving'],
                'answer' => 0
            ]
        ]
    ],
    [
        'title' => 'Network fundamentals',
        'content_path' => 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        'pre_assessment' => [
            [
                'id' => 1,
                'question' => 'What does LAN stand for?',
                'options' => ['Local Area Network','Long Area Network','Large Area Network','Linked Access Network'],
                'answer' => 0
            ]
        ]
    ]
];

$created = 0;
foreach ($modules as $mdata) {
    $existing = Module::where('course_id', $course->id)->where('title', $mdata['title'])->first();
    if ($existing) {
        echo "Module already exists: {$mdata['title']}\n";
        continue;
    }

    $mod = new Module();
    $mod->title = $mdata['title'];
    $mod->content_path = $mdata['content_path'];
    $mod->course_id = $course->id;
    $mod->pre_assessment = json_encode($mdata['pre_assessment']);
    $mod->save();
    echo "Created module: {$mdata['title']}\n";
    $created++;
}

echo "Total modules created: $created\n";
