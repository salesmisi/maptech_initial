<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\LessonFeedback;
use App\Models\LessonFeedbackReply;
use Illuminate\Http\Request;

class FeedbackReplyController extends Controller
{
    // List replies for a feedback
    public function index(Request $request, $feedbackId)
    {
        $fb = LessonFeedback::findOrFail($feedbackId);
        $replies = LessonFeedbackReply::with('user:id,fullname,department')->where('lesson_feedback_id', $fb->id)->orderBy('created_at')->get();
        return response()->json($replies);
    }

    // Store a reply (admin/instructor)
    public function store(Request $request, $feedbackId)
    {
        $request->validate(['comment' => 'required|string|max:2000']);
        $fb = LessonFeedback::findOrFail($feedbackId);

        $reply = LessonFeedbackReply::create([
            'lesson_feedback_id' => $fb->id,
            'user_id' => $request->user()->id,
            'comment' => $request->comment,
        ]);

        return response()->json($reply->load('user:id,fullname,department'), 201);
    }

    public function destroy(Request $request, $id)
    {
        $r = LessonFeedbackReply::findOrFail($id);
        $r->delete();
        return response()->json(['message' => 'Reply deleted']);
    }
}
