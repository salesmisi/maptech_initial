import React, { useState } from 'react';
import { safeArray } from '../../utils/safe';
import {
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Star } from
'lucide-react';
interface Submission {
  id: number;
  student: string;
  department: string;
  quiz: string;
  course: string;
  submittedAt: string;
  autoScore: number;
  manualScore: number | null;
  totalPoints: number;
  status: 'Pending' | 'Graded' | 'Passed' | 'Failed';
  answers: {
    question: string;
    type: 'MCQ' | 'Identification' | 'Essay';
    answer: string;
    correct?: boolean;
    score: number | null;
    maxPoints: number;
  }[];
}
const submissions: Submission[] = [
{
  id: 1,
  student: 'Juan Dela Cruz',
  department: 'IT',
  quiz: 'Module 1: Cybersecurity Basics',
  course: 'Cybersecurity Fundamentals',
  submittedAt: '2025-02-15 10:30 AM',
  autoScore: 10,
  manualScore: null,
  totalPoints: 20,
  status: 'Pending',
  answers: [
  {
    question: 'What is the most common form of cyber attack?',
    type: 'MCQ',
    answer: 'Phishing',
    correct: true,
    score: 5,
    maxPoints: 5
  },
  {
    question: 'Define the CIA triad in cybersecurity.',
    type: 'Essay',
    answer:
    'The CIA triad stands for Confidentiality, Integrity, and Availability. Confidentiality ensures that data is only accessible to authorized users. Integrity means data remains accurate and unaltered. Availability ensures systems and data are accessible when needed.',
    score: null,
    maxPoints: 10
  },
  {
    question: 'What does HTTPS stand for?',
    type: 'Identification',
    answer: 'HyperText Transfer Protocol Secure',
    correct: true,
    score: 5,
    maxPoints: 5
  }]

},
{
  id: 2,
  student: 'Maria Santos',
  department: 'HR',
  quiz: 'Leadership Styles Assessment',
  course: 'Leadership Training 101',
  submittedAt: '2025-02-14 3:15 PM',
  autoScore: 5,
  manualScore: null,
  totalPoints: 20,
  status: 'Pending',
  answers: [
  {
    question: 'Which leadership style involves shared decision-making?',
    type: 'MCQ',
    answer: 'Democratic',
    correct: true,
    score: 5,
    maxPoints: 5
  },
  {
    question:
    'Describe a situation where autocratic leadership is appropriate.',
    type: 'Essay',
    answer:
    'Autocratic leadership is appropriate in emergency situations where quick decisions are needed, such as during a crisis or when team members lack experience and need clear direction.',
    score: null,
    maxPoints: 15
  }]

},
{
  id: 3,
  student: 'Antonio Luna',
  department: 'Marketing',
  quiz: 'Module 1: Cybersecurity Basics',
  course: 'Cybersecurity Fundamentals',
  submittedAt: '2025-02-13 9:00 AM',
  autoScore: 5,
  manualScore: 7,
  totalPoints: 20,
  status: 'Passed',
  answers: [
  {
    question: 'What is the most common form of cyber attack?',
    type: 'MCQ',
    answer: 'DDoS',
    correct: false,
    score: 0,
    maxPoints: 5
  },
  {
    question: 'Define the CIA triad in cybersecurity.',
    type: 'Essay',
    answer:
    'CIA stands for Confidentiality, Integrity, Availability. It is a model for information security.',
    score: 7,
    maxPoints: 10
  },
  {
    question: 'What does HTTPS stand for?',
    type: 'Identification',
    answer: 'HyperText Transfer Protocol Secure',
    correct: true,
    score: 5,
    maxPoints: 5
  }]

}];

export function QuizEvaluation() {
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Graded'>('All');
  const [expandedId, setExpandedId] = useState<number | null>(1);
  const [essayScores, setEssayScores] = useState<Record<string, number>>({});
  const filtered = safeArray<Submission>(submissions).filter(
    (s) =>
    filter === 'All' ||
    s.status === filter ||
    filter === 'Graded' && (s.status === 'Passed' || s.status === 'Failed')
  );
  const handleGrade = (submissionId: number) => {
    alert(`Submission #${submissionId} graded successfully!`);
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quiz Evaluation</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and grade student quiz submissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['All', 'Pending', 'Graded'] as const).map((f) =>
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === f ? 'bg-green-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}>

              {f}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((submission) =>
        <div
          key={submission.id}
          className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">

            <div
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() =>
            setExpandedId(
              expandedId === submission.id ? null : submission.id
            )
            }>

              <div className="flex items-center gap-4">
                {expandedId === submission.id ?
              <ChevronDown className="h-5 w-5 text-slate-400" /> :

              <ChevronRight className="h-5 w-5 text-slate-400" />
              }
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
                  {submission.student.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {submission.student}
                  </p>
                  <p className="text-xs text-slate-500">
                    {submission.quiz} • {submission.course}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {submission.manualScore !== null ?
                  submission.autoScore + submission.manualScore :
                  submission.autoScore}{' '}
                    / {submission.totalPoints}
                  </p>
                  <p className="text-xs text-slate-500">
                    {submission.submittedAt}
                  </p>
                </div>
                <span
                className={`px-2.5 py-1 text-xs font-semibold rounded-full ${submission.status === 'Pending' ? 'bg-amber-100 text-amber-800' : submission.status === 'Passed' ? 'bg-green-100 text-green-800' : submission.status === 'Failed' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>

                  {submission.status === 'Pending' &&
                <Clock className="h-3 w-3 inline mr-1" />
                }
                  {submission.status === 'Passed' &&
                <CheckCircle className="h-3 w-3 inline mr-1" />
                }
                  {submission.status === 'Failed' &&
                <XCircle className="h-3 w-3 inline mr-1" />
                }
                  {submission.status}
                </span>
              </div>
            </div>

            {expandedId === submission.id &&
          <div className="border-t border-slate-200 p-6 bg-slate-50">
                <div className="space-y-4">
                  {submission.answers.map((answer, idx) =>
              <div
                key={idx}
                className="bg-white rounded-lg border border-slate-200 p-4">

                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${answer.type === 'MCQ' ? 'bg-blue-100 text-blue-800' : answer.type === 'Identification' ? 'bg-teal-100 text-teal-800' : 'bg-purple-100 text-purple-800'}`}>

                            {answer.type}
                          </span>
                          <span className="text-xs text-slate-500">
                            {answer.maxPoints} pts
                          </span>
                        </div>
                        {answer.score !== null &&
                  <span
                    className={`text-sm font-bold ${answer.score >= answer.maxPoints * 0.7 ? 'text-green-600' : 'text-red-600'}`}>

                            {answer.score}/{answer.maxPoints}
                          </span>
                  }
                      </div>
                      <p className="text-sm font-medium text-slate-900 mb-2">
                        {answer.question}
                      </p>
                      <div
                  className={`p-3 rounded-md text-sm ${answer.type === 'Essay' ? 'bg-slate-50 border border-slate-200' : answer.correct ? 'bg-green-50 border border-green-200' : answer.correct === false ? 'bg-red-50 border border-red-200' : 'bg-slate-50 border border-slate-200'}`}>

                        {answer.correct === true &&
                  <CheckCircle className="h-4 w-4 text-green-500 inline mr-2" />
                  }
                        {answer.correct === false &&
                  <XCircle className="h-4 w-4 text-red-500 inline mr-2" />
                  }
                        <span className="text-slate-700">{answer.answer}</span>
                      </div>

                      {answer.type === 'Essay' && answer.score === null &&
                <div className="mt-3 flex items-center gap-3">
                          <label className="text-xs font-medium text-slate-500">
                            Score:
                          </label>
                          <input
                    type="number"
                    min={0}
                    max={answer.maxPoints}
                    placeholder={`0-${answer.maxPoints}`}
                    className="w-20 border border-slate-300 rounded-md py-1 px-2 text-sm focus:ring-green-500 focus:border-green-500"
                    onChange={(e) =>
                    setEssayScores({
                      ...essayScores,
                      [`${submission.id}-${idx}`]:
                      parseInt(e.target.value) || 0
                    })
                    } />

                          <span className="text-xs text-slate-400">
                            / {answer.maxPoints}
                          </span>
                        </div>
                }
                    </div>
              )}
                </div>

                {submission.status === 'Pending' &&
            <div className="mt-6 flex justify-end gap-3">
                    <button
                onClick={() => handleGrade(submission.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700">

                      <XCircle className="h-4 w-4 inline mr-1.5" />
                      Mark as Failed
                    </button>
                    <button
                onClick={() => handleGrade(submission.id)}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700">

                      <CheckCircle className="h-4 w-4 inline mr-1.5" />
                      Approve & Pass
                    </button>
                  </div>
            }
              </div>
          }
          </div>
        )}
      </div>
    </div>);

}
