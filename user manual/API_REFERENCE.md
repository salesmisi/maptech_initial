# API Reference — Maptech Initial

This reference summarizes the application's API endpoints grouped by area. Each endpoint lists HTTP method, path, authentication requirements, key request fields, and example responses. Use these examples as a basis for integration tests or a Postman collection.

Base URL: `https://your-app.example.com/api`

Authentication
- POST /login — API token login (public)
  - Body (JSON): { "email": "user@example.com", "password": "secret" }
  - Response: 200 OK
    {
      "token": "<plain-text-token>",
      "user": { "id": 1, "fullname": "Alice" }
    }
  - Notes: returns a Sanctum personal access token. Use `Authorization: Bearer <token>` for subsequent requests.

- POST /logout — Authenticated (auth:sanctum)
  - Invalidates current token or session and records audit log/time log pairing.

- GET /user — Authenticated (auth:sanctum, status)
  - Returns currently authenticated user's profile and role.

Password Reset (OTP flow)
- POST /password/forgot — Send OTP to email (public)
  - Body: { "email": "user@example.com" }
  - Response: 200 OK { "message": "Reset OTP sent" }
  - Rate-limited: default controller limits requests per IP.

- POST /password/verify-otp — Verify OTP (public)
  - Body: { "email": "user@example.com", "otp": "123456" }
  - Response: 200 OK { "token": "<temporary-reset-token>" }

- POST /password/reset — Reset using token (public)
  - Body: { "token": "...", "email": "...", "password": "...", "password_confirmation": "..." }
  - Response: 200 OK { "message": "Password reset successful" }

Departments & Subdepartments
- GET /departments (public) — returns departments with counts and subdepartments.
- POST /departments (admin) — create department
  - Body: { "name": "IT", "code": "IT", "head_id": 5 }
- POST /departments/{id}/subdepartments (admin)

User Management (Admin)
- GET /admin/users — list users (auth:sanctum, role:Admin)
- POST /admin/users — create user
  - Body (JSON):
    {
      "fullname": "John Doe",
      "email": "john@example.com",
      "password": "Passw0rd!",
      "role": "employee",
      "department": "IT",
      "subdepartment_id": 3
    }
  - Response: 201 Created { "message": "User created", "user": { ... } }

- POST /admin/users/{id}/photo — multipart/form-data, file field `photo`
- GET /admin/users/{id}/recovery-key — returns masked recovery key (admin only)
- POST /admin/users/{id}/regenerate-recovery-key — regenerates stored recovery key

Course, Module & Lesson Management
Pattern: Admin can manage all resources under `/admin/*`; instructors manage own courses under `/instructor/*`; employees receive course content via `/employee/*` or generic authenticated routes.

- GET /admin/courses — list courses (Admin)
- POST /admin/courses — create course (Admin)
  - Body: { "title": "Course title", "department": "IT", "subdepartment_id": 2, "start_date": "2026-05-01", "deadline": "2026-05-31" }

- POST /admin/courses/{id}/modules — upload module (file or metadata). Files stored in `storage/app/public`.
- POST /admin/modules/{moduleId}/lessons — add lesson to a module (multipart/form-data for files)

Enrollment & Locks
- POST /admin/courses/{id}/enrollments — enroll user (JSON { user_id: <id> })
- POST /admin/courses/{courseId}/modules/{moduleId}/enrollments/{userId}/unlock — admin unlock module for a user

Quizzes
- GET /admin/quizzes, GET /admin/courses/{courseId}/quizzes — list quizzes
- POST /admin/courses/{courseId}/quizzes — create quiz (Admin/Instructor)
- POST /employee/quizzes/{quizId}/submit — employee submits answers
  - Body: { "answers": [{"question_id":1,"choice_id":2}, ...] }
  - Response: { "score": 85, "percentage": 85 }

Q&A (Questions & Replies)
- Employee endpoints: POST /employee/questions — create question
- Instructor endpoints: POST /instructor/questions/{id}/replies — reply to a question
- Admin endpoints: POST /admin/questions/{id}/answer — admin posts canonical answer

Notifications & Announcements
- GET /notifications — list user's notifications (auth)
- POST /admin/notifications/announce — create announcement to roles/department/course/users
  - Body supports: `title`, `body`, `roles` (array), `department`, `course_id`, `target_user_ids`, `image` (optional multipart).

Audit Logs
- GET /audit-logs — admin paginated audit log query
  - Query params: `role`, `user_id`, `per_page`, `page`
- POST /audit-logs/bulk-delete — delete selected logs (admin); auto-cleanup permanently deletes oldest trashed rows when threshold reached.

Time Logs (Punch In / Punch Out)
- POST /time-logs/punch-in — create a time log (auth)
  - Body: optional metadata (e.g., `note`)
  - Response: created time log with `time_in`
- POST /time-logs/punch-out — close open time log
- GET /time-logs/me — list current user's time logs

File Conversion
- GET /convert/availability — checks if LibreOffice is available for conversions
- POST /convert/pdf-to-pptx — convert uploaded PDF to PPTX
  - multipart/form-data: `file` field (application/pdf)
  - Response: { "download_url": ".../converted.pptx" }
- POST /convert/pptx-to-pdf — convert uploaded PPTX to PDF
- POST /convert/pptx-as-pdf — return PPTX file rendered as PDF (useful for previews)
  - Note: conversions use `soffice` (LibreOffice). Ensure `soffice` is installed and `services.libreoffice.path` is configured if non-standard.

Profile & Settings
- GET /profile — returns user profile
- POST /profile — update profile (Admins may update email/password)
- POST /profile/picture — upload `profile_picture` (multipart)
- POST /profile/signature — upload instructor/admin signature (image)

Analytics & Lesson Events
- POST /lesson-events — record lesson playback events (auth)
- GET /admin/lesson-events — admin query for recent events

Developer / Local Utilities
- Routes guarded by `env('APP_ENV') === 'local'` offer dev helper endpoints:
  - POST /dev/create-it-test — create test users & return token
  - POST /dev/create-admin-and-test-users — create dev admin + users

Errors & Common Response Shapes
- Validation error: 422 Unprocessable Entity
  { "message": "Validation failed", "errors": {"field": ["error message"]} }
- Not found: 404
  { "message": "Not found" }
- Unauthorized/Forbidden: 401 / 403
  { "message": "Unauthenticated" } or { "message": "Forbidden" }

Appendix: Example cURL (login + fetch profile)
```bash
curl -X POST "https://your-app.example.com/api/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"dev-admin@example.com","password":"password"}'

# then
curl -H "Authorization: Bearer <token>" "https://your-app.example.com/api/user"
```

---

This file is a high-level programmatic reference. For integration tasks I can generate an OpenAPI YAML (`user manual/openapi.yaml`) or a Postman collection next — which would include formal request/response schemas and can be imported directly into tools.
