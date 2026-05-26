# Maptech LMS — User Manual
## Overview
Maptech LMS is a Laravel-based Learning Management System used by Maptech Information Solutions Inc. It provides role-based access for three user types:
Admin — Full system control: user management, course creation, department configuration, analytics, and system settings.
Instructor — Course delivery: create and manage courses, modules, lessons, quizzes, enrollments, and answer employee questions.
Employee — Learning consumption: browse courses, complete lessons, take quizzes, ask questions, and track progress.

## System Requirements
| Component | Version |
| --- | --- |
| PHP | ^8.2 |
| Laravel | ^12.0 |
| Node.js | 18+ |
| Database | MySQL / MariaDB / SQLite |


# Part 1: Getting Started
## 1.1 Accessing the System
Open your browser and navigate to the application URL (e.g., http://localhost:8000 or your production URL).
You will see the login page.
## 1.2 Logging In
Enter your email in the email field.
Enter your password in the password field.
Click the Login button.
Upon successful authentication, you will be redirected to your role-based dashboard.
Note: If you forget your password, use the Forgot Password? link to reset via OTP.
## 1.3 Logging Out
Click your profile icon in the top-right corner of the screen.
Select Logout from the dropdown menu.
You will be redirected to the login page.


# Part 2: Admin Side — Full System Control
The Admin dashboard provides complete control over users, courses, departments, and system analytics.
## 2.1 Admin Dashboard
Navigation: Home → Dashboard
After logging in as Admin:
The dashboard displays KPIs:
Total Users — Count of all registered users.
Active Courses — Number of published courses.
Total Enrollments — Active learner enrollments.
Pending Reviews — Quizzes or questions awaiting review.
Use the sidebar menu to navigate to different admin functions.
## 2.2 User Management
Navigation: Admin → Users or Sidebar: User Management
### Viewing Users
Click Users in the sidebar.
The user list displays: Name, Email, Role, Department, Status.
Use the Search bar to filter by name or email.
Use the Filter dropdown to filter by Role (Admin/Instructor/Employee) or Department.
### Creating a New User
Click the + Add User button.
Fill in the form:
Full Name — Enter the user's full name.
Email — Enter a valid email address.
Password — Enter a strong password (min 8 chars, 1 uppercase, 1 special char, 2 numbers).
Role — Select Admin, Instructor, or Employee.
Department — Select the appropriate department.
Subdepartment — Select a subdepartment (required for Employees).
Click Save.
### Editing a User
Find the user in the list.
Click the Edit (pencil) icon next to the user.
Modify the desired fields.
Click Update.
### Deleting a User
Find the user in the list.
Click the Delete (trash) icon.
Confirm the deletion in the popup dialog.
### Managing User Photos
Click on a user to view their profile.
Under the Photo section, click Upload Photo.
Select an image file (JPG, PNG).
Click Save.
### Regenerating Recovery Key
Open a user's profile.
Click Regenerate Recovery Key.
A new 19-character recovery key is generated.
Share the key securely with the user.
## 2.3 Department Management
Navigation: Admin → Departments
### Creating a Department
Click + Add Department.
Enter the Department Name.
Select a Department Head (must be Admin or Instructor).
Click Save.
### Managing Subdepartments
Click on a department to view its details.
Under Subdepartments, click + Add Subdepartment.
Enter the subdepartment name.
Click Save.
### Editing/Deleting Departments
Click the Edit or Delete icon next to the department.
Confirm or modify as needed.
## 2.4 Course Management
Navigation: Admin → Courses
### Creating a New Course
Click + Create Course.
Fill in the course details:
Title — Course name.
Description — Course overview.
Department — Assign to a department.
Subdepartment — Optionally assign to a subdepartment.
Status — Active, Inactive, or Draft.
Start Date — Course start date.
Deadline — Course completion deadline.
Logo — Upload a course thumbnail (optional).
Click Save.
### Managing Modules
Open a course.
Under the Modules tab, click + Add Module.
Enter module title and description.
Click Save.
### Managing Lessons
Open a module.
Click + Add Lesson.
Choose lesson type:
Video — Upload a video file or enter a URL.
Document — Upload PDF, PPTX, or other documents.
Text — Enter text content directly.
Fill in title, description, duration.
Click Save.
### Reordering Modules
In the course modules view, drag and drop modules to reorder.
Click Save Order.
### Deleting Course/Module/Lesson
Click the Delete icon next to the item.
Confirm deletion in the popup.
## 2.5 Enrollment Management
Navigation: Admin → Courses → Enrollments
### Enrolling Users
Open a course.
Go to the Enrollments tab.
Click + Enroll User.
Search and select a user.
Click Enroll.
### Bulk Enroll
Click Bulk Enroll.
Select multiple users via checkboxes.
Click Enroll Selected.
### Locking/Unlocking Enrollments
Find an enrolled user.
Click Lock to prevent access.
Click Unlock to restore access.
### Module-Level Lock/Unlock
Go to Modules in a course.
Click the lock icon next to a module for a specific user.
Use Lock Department to lock/unlock for entire departments.
## 2.6 Quiz Management
Navigation: Admin → Quizzes or within a Course's module
### Creating a Quiz
Open a module in a course.
Click + Add Quiz.
Enter quiz title and description.
Click Save.
### Adding Questions
Open the quiz.
Click + Add Question.
Enter the question text.
Provide answer options (mark the correct answer).
Set point value.
Click Save.
### Managing Attempts
Go to Quiz Attempts in the quiz view.
View attempt history, scores, and timestamps.
Export attempts if needed.
## 2.7 Announcements & Notifications
Navigation: Admin → Announcements
### Creating an Announcement
Click + New Announcement.
Fill in:
Title — Announcement subject.
Message — Announcement body.
Target Audience — Select roles (All, Instructors, Employees), departments, or specific users.
Course — Optionally link to a course.
Click Publish.
### Managing Notifications
Go to Notifications in the sidebar.
View all sent notifications.
Use Restore to recover deleted notifications.
Use Permanently Delete to remove notifications.
## 2.8 Analytics & Reports
Navigation: Admin → Analytics
### Viewing Analytics
The analytics page shows:
Course completion rates.
User activity trends.
Quiz performance summaries.
Lesson engagement metrics.
Use date filters to view specific periods.
Export reports as needed.
### Audit Logs
Navigation: Admin → `Audit Logs**
View system activity logs:
Login/logout events.
User actions (create, update, delete).
Course modifications.
Filter by date, user, or action type.
Use Bulk Delete to clean old logs.
## 2.9 Time Log Management
Navigation: Admin → Time Logs
### Viewing User Time Logs
Select a user from the dropdown.
View their punch-in/punch-out history.
Use filters to narrow by date range.
### Editing Time Logs
Click Edit on a specific log entry.
Modify time_in or time_out.
Click Update.


# Part 3: Instructor Side — Course Delivery
Instructors manage their assigned courses, respond to questions, and monitor learner progress.
## 3.1 Instructor Dashboard
Navigation: Home → Dashboard
After logging in as Instructor:
View your dashboard showing:
Total Courses — Courses you teach.
Total Students — Enrolled learners.
Average Pass Rate — Quiz performance.
Pending Reviews — Questions awaiting answers.
Click on any metric to drill down.
## 3.2 My Courses
Navigation: My Courses in the sidebar
### Creating a Course
Click + Create Course.
Fill in course details (title, description, department, subdepartment, status, dates).
Upload a logo (optional).
Click Save.
### Editing a Course
Click on a course to open it.
Click Edit to modify details.
Click Update.
### Deleting a Course
Open the course.
Click Delete.
Confirm in the popup.
## 3.3 Module & Lesson Management
Navigation: My Courses → Select Course → Modules
### Adding Modules
In your course, click + Add Module.
Enter module title and description.
Click Save.
### Adding Lessons
Open a module.
Click + Add Lesson.
Select type: Video, Document, or Text.
Fill in details and upload content.
Click Save.
### Reordering Modules/Lessons
Drag and drop to reorder.
Click Save Order.
### Converting Files
In a lesson, click Convert.
Select conversion type (PDF→PPTX, PPTX→PDF).
Wait for conversion to complete.
Save the converted file.
## 3.4 Enrollment Management
Navigation: My Courses → Select Course → Enrollments
### Enrolling Students
Click + Enroll User.
Search and select users.
Click Enroll.
### Locking/Unlocking
Find an enrolled student.
Click Lock or Unlock to control access.
Use Module Lock to lock specific modules for users.
### Department-Level Unlock
Click Unlock Department.
Select a department.
Confirm to unlock all modules for that department.
## 3.5 Quiz Management
Navigation: My Courses → Select Course → Quizzes
### Creating a Quiz
Open a module.
Click + Add Quiz.
Enter quiz details.
Click Save.
### Adding Questions
Open the quiz.
Click + Add Question.
Enter question and options.
Mark the correct answer.
Click Save.
### Viewing Attempts
Go to Attempts in the quiz.
View student submissions and scores.
Export data if needed.
## 3.6 Q&A Management
Navigation: Questions in the sidebar
### Viewing Questions
All questions from your courses are listed.
Filter by: Pending, Answered, Course.
### Answering a Question
Click on a question.
Type your answer in the reply box.
Click Submit Reply.
### Deleting Replies
Find the reply.
Click Delete.
Confirm deletion.
## 3.7 Notifications to Employees
Navigation: Notifications → Notify Employees
Click + New Notification.
Select target employees (by course, department, or individual).
Write the message.
Click Send.
## 3.8 Feedback Management
Navigation: Feedback in the sidebar
### Viewing Feedback
View lesson and quiz feedback from students.
Filter by course or lesson.
Reply to feedback if needed.


# Part 4: Employee Side — Learning Consumption
Employees browse courses, complete lessons, take quizzes, and track their progress.
## 4.1 Employee Dashboard
Navigation: Home → Dashboard
After logging in as Employee:
Your dashboard shows:
Enrolled Courses — Courses you are taking.
Progress — Overall completion percentage.
Upcoming Quizzes — Quizzes due soon.
Announcements — Latest notices.
Click on a course to continue learning.
## 4.2 Browsing Available Courses
Navigation: All Courses in the sidebar
Click All Courses.
View courses available to your department.
Use the search bar to find specific courses.
Click Details to view course info.
## 4.3 Self-Enrollment
Navigation: All Courses → Select Course → Enroll
Open a course details page.
If self-enrollment is allowed, click Enroll.
You will be redirected to the course content.
## 4.4 Viewing My Courses
Navigation: My Courses in the sidebar
Click My Courses.
View all courses you are enrolled in.
Click on a course to continue where you left off.
## 4.5 Taking Lessons
Navigation: My Courses → Select Course → Modules → Lessons
Open a lesson within a module.
The content (video, document, or text) loads.
For video lessons: playback events are recorded automatically.
Click Mark Complete when finished (if required).
## 4.6 Taking Quizzes
Navigation: My Courses → Select Course → Module → Quiz
### Starting a Quiz
Open a quiz in your module.
Click Start Quiz.
Read each question and select an answer.
Click Next to proceed.
### Submitting Answers
After answering all questions, click Submit.
Confirm submission in the popup.
View your score immediately.
### Reviewing Attempts
Go to My Quiz Attempts.
View past attempts, scores, and feedback.
Identify areas for improvement.
## 4.7 Asking Questions (Q&A)
Navigation: Questions in the sidebar
### Posting a Question
Click + Ask Question.
Select the related lesson.
Enter your question in the text box.
Click Submit.
### Viewing Answers
Go to My Questions.
View questions you asked and their answers.
Click on a question to see full details and replies.
### Replying to Answers
Open a question with an answer.
Type a reply in the response box.
Click Submit Reply.
## 4.8 Notifications & Announcements
Navigation: Notifications in the sidebar
### Viewing Notifications
Click Notifications.
View all received announcements and messages.
Unread items are highlighted.
### Marking as Read
Click on a notification to open it.
It is automatically marked as read.
Use Mark All as Read to clear all unread.
### Reporting to Admin
Click Report Issue.
Describe the problem.
Click Submit.
## 4.9 Progress & Certificates
Navigation: Progress and Certificates in the sidebar
### Viewing Progress
Click Progress.
See completion percentage for each enrolled course.
View module-level progress details.
### Downloading Certificates
Click Certificates.
View earned certificates.
Click Download to save as PDF.
## 4.10 Profile Management
Navigation: Profile in the sidebar
### Viewing Profile
Click Profile.
View your name, email, role, department.
### Updating Profile
Click Edit Profile.
Update allowed fields.
Click Save.
### Uploading Profile Picture
Click Upload Photo.
Select an image file.
Click Save.
## 4.11 Time Logging (Time In/Out)
Navigation: Time Logs in the sidebar
### timing In
Click Punch In.
Your start time is recorded.
A confirmation appears.
### timing Out
Click Punch Out.
Your end time is recorded.
View your time log history.


# Part 5: Common Operations
## 5.1 Password Reset (OTP Flow)
On the login page, click Forgot Password?.
Enter your email.
Click Send OTP.
Check your email for the 6-digit OTP.
Enter the OTP on the verification page.
Enter a new password (min 8 chars, 1 uppercase, 1 special, 2 numbers).
Click Reset Password.
## 5.2 Using Recovery Key
If you cannot receive OTP:
Contact your administrator for your recovery key.
On the login page, click Forgot Password?.
Select Use Recovery Key.
Enter your email and recovery key.
Set a new password.
## 5.3 File Upload Guidelines
| File Type | Max Size | Supported Formats |
| --- | --- | --- |
| Images | 5 MB | JPG, PNG, GIF |
| Videos | 100 MB | MP4, MOV, AVI |
| Documents | 20 MB | PDF, PPTX, DOCX |



# Part 6: Troubleshooting
| Issue | Solution |
| --- | --- |
| Login fails | Verify email/password; use "Forgot Password" if needed. |
| Cannot see courses | Ensure your department is assigned to the course. |
| Quiz won't submit | Check your internet connection and try again. |
| File upload fails | Verify file size and format; try a different browser. |
| Locked out of account | Contact admin for recovery key or manual reset. |



# Part 7: System Information
Version: Laravel 12.x
PHP Version: 8.2+
Database: MySQL / MariaDB / SQLite
Authentication: Session-based (web) + Sanctum (API)
For technical support, contact your system administrator.
scripts/ contains utilities used by ops and maintainers. Notable scripts:
create_admin_account.php — create a bootstrap admin user.
create_token.php, test_token_request.php, test_cookie_login.php — helpers for auth testing.
seed_user_timelog.php, seed_modules_with_quiz.php — data seeding helpers.
send_announce.php, smoke_notify_check.php, smoke_notify_dump.php — notification testing and smoke checks.
fetch_audit_logs.ps1 — PowerShell script to extract audit logs from remote systems.
Implementation notes & important behaviors
Middleware: many API routes require auth:sanctum, status and role:<Role> middlewares to secure endpoints.
Timestamps: controllers normalize times to UTC ISO8601 for API responses.
Validation: controllers perform extensive request validation and cross-field checks (e.g., subdepartment must belong to department).
Safety: password reset flow intentionally returns generic success messages to prevent email enumeration.
## Function Usage & Runbooks
These short runbooks show typical API flows and command sequences used by operators and integrators.
API Login (token-based) — quickest way to script actions:
Request a token: curl -X POST "${APP_URL:-http://localhost:8000}/api/login" \
-H "Content-Type: application/json" \
-d '{"email":"dev-admin@example.com","password":"password"}'

Use returned token for authenticated calls: curl -H "Authorization: Bearer <token>" "${APP_URL:-http://localhost:8000}/api/user"

Password Reset (OTP) — full flow for users who lost passwords:
Send OTP: POST /api/password/forgot with { "email": "user@example.com" }.
Verify OTP: POST /api/password/verify-otp with { "email": "user@example.com", "otp": "123456" } → returns a temporary reset token.
Reset password: POST /api/password/reset with { "token": "...", "email": "...", "password": "NewPass123!", "password_confirmation": "NewPass123!" }.
If recovery keys are used, POST /api/password/reset-with-recovery-key accepts { "email": "...", "recovery_key": "...", "password": "..." }.
Punch In / Punch Out (time tracking):
Punch in: POST /api/time-logs/punch-in (auth) — creates a TimeLog with time_in.
Punch out: POST /api/time-logs/punch-out (auth) — closes latest open TimeLog and records time_out.
Admins: use GET /api/time-logs/{userId} to inspect any user's logs, and PUT /api/time-logs/admin/{logId} to update entries.
Convert PDF → PPTX (lesson/module conversions):
Check availability: GET /api/convert/availability — returns LibreOffice availability.
Convert PDF (multipart): POST /api/convert/pdf-to-pptx with form-data file=@lesson.pdf.
Lesson/module helper endpoints exist for lesson/module-scoped conversion: POST /api/convert/lessons/{lessonId}/pdf-to-pptx.
Create user (Admin): curl -X POST "${APP_URL:-http://localhost:8000}/api/admin/users" \
-H "Authorization: Bearer <admin-token>" \
-H "Content-Type: application/json" \
-d '{"fullname":"Jane Doe","email":"jane@example.com","password":"StrongP@ss1","role":"employee","department":"HR","subdepartment_id":4}'

Enroll a user into a course (Admin/Instructor):
Admin: POST /api/admin/courses/{id}/enrollments with { "user_id": 123 }.
Instructor (own course): POST /api/instructor/courses/{id}/enrollments with same payload.
Create an announcement (Admin):
POST /api/admin/notifications/announce can target roles, department, course_id, or target_user_ids. Use multipart to attach images.
Operational notes
Logs: primary logs are in storage/logs/laravel.log. Audit logs are stored in audit_logs table and can be queried via the API.
Files: uploaded content and converted files are in storage/app/public (served via asset('storage/...')). Ensure php artisan storage:link is run in deployments.
Background jobs: ensure queue workers are running (php artisan queue:work) for email delivery, conversions, notifications, and other jobs.
OpenAPI / Postman
I can generate an OpenAPI YAML (user manual/openapi.yaml) and a Postman collection from the routes/controllers. Would you like the OpenAPI spec generated now?

## Instructor — Functions (Detailed)
This section documents the instructor-facing functions, controllers, endpoints, request fields, responses, permissions, and operational notes. It supplements the higher-level Instructor Pages summary.
Dashboard
Purpose: instructor-scoped KPIs, trends, pending questions, and quick actions.
Controller: App\Http\Controllers\Instructor\CourseController::dashboard.
Endpoint: GET /api/instructor/dashboard (auth:sanctum, role:Instructor).
Key outputs: stats (total_courses, total_students, avg_pass_rate, pending_reviews), performance_trend, course_stats, pending_evaluations, recent_questions.
Course CRUD (My Courses)
Purpose: create and manage instructor-owned courses.
Controller: App\Http\Controllers\Instructor\CourseController.
Endpoints:
GET /api/instructor/courses — list scoped courses.
POST /api/instructor/courses — create course. Key fields: title, description, department, subdepartment_id, status (Active/Inactive/Draft), start_date, deadline, logo (multipart).
GET /api/instructor/courses/{id} — show course (includes modules.lessons and enrolledUsers).
PUT /api/instructor/courses/{id} — update course metadata.
DELETE /api/instructor/courses/{id} — delete course.
Important: creation validates that subdepartment_id belongs to the declared department and that the instructor is authorized for that subdepartment.
Modules & Lessons
Purpose: manage learning content (modules and lessons) — upload files, metadata, reorder.
Endpoints (selected):
POST /api/instructor/courses/{id}/modules — create module (file or metadata).
PUT /api/instructor/courses/{courseId}/modules/{moduleId} — update module details.
DELETE /api/instructor/courses/{courseId}/modules/{moduleId} — delete module.
POST /api/instructor/courses/{courseId}/modules/reorder — reorder modules.
POST /api/instructor/modules/{moduleId}/lessons — add lesson (multipart: content file; fields: title, type, description, duration).
POST /api/instructor/modules/{moduleId}/lessons/{lessonId} — update lesson.
DELETE /api/instructor/modules/{moduleId}/lessons/{lessonId} — delete lesson.
Files are stored on the public disk and served via asset('storage/...'). Conversion endpoints are available for PDF/PPTX transformations.
Enrollment Management (Instructor-scoped)
Purpose: enroll/unenroll learners in instructor courses and manage per-course/module locks.
Endpoints (selected):
GET /api/instructor/courses/{id}/enrollments — list enrollments.
POST /api/instructor/courses/{id}/enrollments — enroll user (body: { user_id }).
DELETE /api/instructor/courses/{courseId}/enrollments/{userId} — unenroll.
POST /api/instructor/courses/{courseId}/enrollments/{userId}/lock and /unlock — course-level lock/unlock.
POST /api/instructor/courses/{courseId}/modules/{moduleId}/enrollments/{userId}/lock and /unlock — per-module lock/unlock.
POST /api/instructor/courses/{courseId}/modules/{moduleId}/unlock-department and lock-department — bulk department-level unlock/lock.
Notes: pivot table module_user holds manual unlocks (unlocked, unlocked_until). Instructor actions are validated against assignment scope.
Quizzes (Instructor)
Purpose: author quizzes, manage questions, and view attempts for instructor's courses.
Controller: App\Http\Controllers\Instructor\QuizController.
Endpoints (selected):
GET /api/instructor/quizzes — list quizzes the instructor can manage.
GET /api/instructor/quiz-attempts — list attempts for instructor-scoped quizzes.
POST /api/instructor/courses/{courseId}/quizzes — create quiz.
POST /api/instructor/quizzes/{quizId}/questions — add question.
PUT/DELETE endpoints for quizzes/questions exist for update/removal.
Q&A (Instructor)
Purpose: respond to student questions on lessons, manage replies and reactions.
Controller: App\Http\Controllers\QAController (instructor methods).
Endpoints: GET /api/instructor/lessons, GET /api/instructor/questions, POST /api/instructor/questions/{id}/replies, DELETE /api/instructor/questions/{questionId}/replies/{replyId}, POST /api/instructor/questions/{questionId}/replies/{replyId}/reactions.
Notifications (Instructor)
Purpose: send notifications to employees (students) or admins and manage instructor-sent notifications.
Controller: App\Http\Controllers\NotificationController (instructor routes).
Endpoints: GET /api/instructor/notifications, GET /api/instructor/notifications/unread-count, POST /api/instructor/notifications/notify-employees, POST /api/instructor/notifications/notify-admin, and management endpoints (mark read, restore, delete).
Feedback
Purpose: view and export lesson/quiz feedback for courses the instructor teaches; reply where appropriate.
Endpoint: GET /api/instructor/feedbacks (supports course_id and lesson_id filters).
Custom Modules (Instructor interactions)
Purpose: view published learning modules, edit lesson content where permitted, and push modules to departments.
Endpoints: GET /api/instructor/custom-modules, GET /api/instructor/custom-modules/{id}, PUT /api/instructor/custom-modules/{moduleId}/lessons/{lessonId}, POST /api/instructor/custom-modules/{id}/push-to-department.
### Access & Operational Notes (Instructor)
Middleware: auth:sanctum, status, role:Instructor.
Data scope: ownership or assignment via subdepartments/department.
Performance: recalculating progress is performed when loading course details — this may be expensive for large courses. Consider caching or background recalculation for dashboards.

## Employee — Functions (Detailed)
This section documents employee-facing functions, controllers, endpoints, request fields, responses, permissions, and practical notes.
Dashboard
Purpose: department-scoped view of available courses, personalized progress, upcoming quizzes, certificates, and announcements.
Controller: App\Http\Controllers\Employee\DashboardController::index.
Endpoint: GET /api/employee/dashboard (auth:sanctum, role:Employee, department middleware).
Browse Courses & Self-Enrollment
Purpose: discover active courses available to the employee's department and self-enroll where allowed.
Endpoint: GET /api/employee/all-courses — department-scoped course list.
Self-enroll: POST /api/employee/courses/{id}/enroll (subject to course/enrollment rules).
My Courses & Course Detail
Purpose: view enrolled courses, module access, progress, and lesson content.
Endpoints: GET /api/employee/courses, GET /api/employee/courses/{id} (showCourse).
Progress & Certificates
Purpose: monitor progress and access/download certificates.
Endpoints: GET /api/employee/progress, GET /api/employee/certificates, POST /api/employee/certificates/{id}/logo, DELETE /api/employee/certificates/{id}/logo.
Lesson Content & Feedback
Purpose: access lesson files, record playback events, and submit feedback.
Endpoints:
GET /api/modules/{module}/content — serves lesson file when authorized (authenticated users).
POST /api/lesson-events — record playback events.
Feedback endpoints: GET/POST/PUT/DELETE /api/employee/feedbacks and quiz feedback variants under /api/employee/quiz-feedbacks.
Quizzes (Taking)
Purpose: take assigned quizzes, submit answers, and review attempt history.
Endpoints:
GET /api/employee/quizzes/{quizId} — quiz details.
POST /api/employee/quizzes/{quizId}/submit — submit answers (body: answers array).
GET /api/employee/quizzes/{quizId}/attempts — list own attempts.
GET /api/employee/quiz-reminders — upcoming quiz reminders.
Q&A (Employee)
Purpose: post questions on lessons, update/delete own questions, add replies, and react to replies.
Endpoints: GET /api/employee/lessons, GET /api/employee/questions, POST /api/employee/questions, PUT /api/employee/questions/{id}, DELETE /api/employee/questions/{id}, plus replies endpoints.
Notifications (Employee)
Purpose: receive & manage notifications/announcements and escalate issues to instructors/admins.
Endpoints: under /api/employee/notifications — index, unread-count, recently-deleted, markAsRead, markAllAsRead, destroy, restoreNotification, permanentlyDeleteNotification, employeeNotifyInstructor, employeeReportToAdmin.
Custom Modules (Assigned)
Purpose: access learning modules assigned by Admin or Instructor.
Endpoints: GET /api/employee/custom-modules (assignedModules), GET /api/employee/custom-modules/{id} (show).
Profile, Pictures & Signatures
Purpose: view/update profile fields allowed to non-admins and upload pictures.
Endpoints: GET /api/profile, POST /api/profile (note: only admins can change email/password), POST /api/profile/picture, DELETE /api/profile/picture, POST /api/profile/signature (admins/instructors only).
Time Logs (Punch In / Punch Out)
Purpose: record work time by creating and closing time log entries.
Endpoints: POST /api/time-logs/punch-in, POST /api/time-logs/punch-out, GET /api/time-logs/me.
Notes: Time logs attempt to link to AuditLog entries when possible; contact Admin to correct mismatch or request archival edits.
### Access & Operational Notes (Employee)
Middleware: auth:sanctum, status, role:Employee, and department enforce scope and membership.
Data visibility: employees see courses and content limited to their department/subdepartment and unlocked modules.
