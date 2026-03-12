<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\LessonFeedback;
use App\Models\LessonFeedbackReply;
use App\Models\QuizFeedback;
use App\Models\QuizFeedbackReply;
use Illuminate\Http\Request;

class FeedbackReplyController extends Controller
{
    // List replies for a feedback
    public function index(Request $request, $feedbackId)
    {
        // Try lesson feedback first, then quiz feedback
        $fb = LessonFeedback::find($feedbackId);
        if ($fb) {
            $replies = LessonFeedbackReply::with('user:id,fullname,department')->where('lesson_feedback_id', $fb->id)->orderBy('created_at')->get();
            return response()->json($replies);
        }

        $qfb = QuizFeedback::findOrFail($feedbackId);
        $replies = QuizFeedbackReply::with('user:id,fullname,department')->where('quiz_feedback_id', $qfb->id)->orderBy('created_at')->get();
        return response()->json($replies);
    }

    // Store a reply (admin/instructor)
    public function store(Request $request, $feedbackId)
    {
        $request->validate(['comment' => 'required|string|max:2000']);
        // If lesson feedback exists, create a lesson reply, else create quiz reply
        $fb = LessonFeedback::find($feedbackId);
        if ($fb) {
            $reply = LessonFeedbackReply::create([
                'lesson_feedback_id' => $fb->id,
                'user_id' => $request->user()->id,
                'comment' => $request->comment,
            ]);
            return response()->json($reply->load('user:id,fullname,department'), 201);
        }

        $qfb = QuizFeedback::findOrFail($feedbackId);
        $reply = QuizFeedbackReply::create([
            'quiz_feedback_id' => $qfb->id,
            'user_id' => $request->user()->id,
            'comment' => $request->comment,
        ]);

        return response()->json($reply->load('user:id,fullname,department'), 201);
    }

    public function destroy(Request $request, $id)
    {
        // Try deleting from lesson replies, then quiz replies
        $r = LessonFeedbackReply::find($id);
        if ($r) { $r->delete(); return response()->json(['message' => 'Reply deleted']); }
        $r2 = QuizFeedbackReply::findOrFail($id);
        $r2->delete();
        return response()->json(['message' => 'Reply deleted']);
    }
}
