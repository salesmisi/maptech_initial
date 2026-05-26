# Maptech LMS — System Documentation

> Version: 1.0  ·  Last updated: 2026-05-04
> Companion docs: [README.md](../README.md) · [BROADCAST_SETUP.md](../BROADCAST_SETUP.md) · [CONTENT_SYNC_SYSTEM.md](../CONTENT_SYNC_SYSTEM.md) · [CUSTOM_UI_COMPONENTS.md](../CUSTOM_UI_COMPONENTS.md) · [CODEBASE_EXPLORATION_REPORT.md](../CODEBASE_EXPLORATION_REPORT.md) · [USER_MANUAL.md](../user%20manual/USER_MANUAL.md)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Requirements](#2-system-requirements)
3. [Architecture Overview](#3-architecture-overview)
4. [Installation & Setup](#4-installation--setup)
5. [Configuration Reference](#5-configuration-reference)
6. [Authentication & Security](#6-authentication--security)
7. [Roles & Authorization (RBAC)](#7-roles--authorization-rbac)
8. [Domain Model / Data Dictionary](#8-domain-model--data-dictionary)
9. [Database](#9-database)
10. [API Reference](#10-api-reference)
11. [Web Routes](#11-web-routes)
12. [Frontend Architecture](#12-frontend-architecture)
13. [Real-Time / Broadcasting](#13-real-time--broadcasting)
14. [Content Sync System](#14-content-sync-system)
15. [Custom UI Components](#15-custom-ui-components)
16. [Course & Enrollment Lifecycle](#16-course--enrollment-lifecycle)
17. [Quiz & Assessment](#17-quiz--assessment)
18. [Q&A and Feedback](#18-qa-and-feedback)
19. [Notifications](#19-notifications)
20. [Time Tracking](#20-time-tracking)
21. [Audit Logging](#21-audit-logging)
22. [File Handling & Integrations](#22-file-handling--integrations)
23. [Mail & OTP](#23-mail--otp)
24. [Background Jobs & Queue](#24-background-jobs--queue)
25. [Operational Scripts](#25-operational-scripts)
26. [Testing](#26-testing)
27. [Deployment](#27-deployment)
28. [Backup & Recovery](#28-backup--recovery)
29. [Troubleshooting & FAQ](#29-troubleshooting--faq)
30. [Maintenance & Upgrade](#30-maintenance--upgrade)

---

## 1. Introduction

**Maptech LMS** is a role-based Learning Management System for organizations to deliver internal training and certification programs. It centralizes course delivery, employee enrollment, assessments, instructor support, and administrative oversight in a single SPA backed by a Laravel API.

**Primary user roles**
- **Admin** — manages users, departments, courses, custom modules, business branding, audit logs, reports.
- **Instructor** — creates/manages assigned courses, lessons, quizzes; answers Q&A; reviews enrollments.
- **Employee** — enrolls in/consumes courses, takes quizzes, downloads certificates, submits feedback.

**Core capabilities**
- Course → Module → Lesson → Quiz hierarchy with progress tracking
- Custom modules and custom UI components built by Admin and synced to multiple courses
- Real-time notifications, content sync, and module unlock events via Pusher / Laravel Echo
- OTP-based password reset and recovery-key recovery
- Punch in / punch out time tracking with audit-log linkage
- Comprehensive audit logging (timezone-aware) for compliance
- Certificate generation with company branding
- Department / subdepartment hierarchy with role-scoped access

**Glossary**
| Term | Meaning |
|---|---|
| Course | Top-level training unit assigned to enrollees |
| Module | Ordered section of a course; can be locked / time-limited |
| Lesson | Atomic content (text, video, file) inside a module |
| Custom Module | Reusable module built by Admin, pushable into many courses |
| Enrollment | Assignment of a user to a course (status, progress, lock) |
| Quiz Attempt | A user's single submission of a quiz with score |
| Audit Log | Immutable record of a user-triggered action |
| Time Log | Punch-in / punch-out record linked to login/logout audit entries |

---

## 2. System Requirements

**Server**
- PHP **8.2+** with extensions: `mbstring`, `openssl`, `pdo`, `pdo_mysql` (or `pdo_pgsql`), `tokenizer`, `xml`, `ctype`, `json`, `bcmath`, `fileinfo`, `gd` or `imagick`
- Composer **2.x**
- Database: MySQL 8.x / MariaDB 10.6+ / PostgreSQL 14+ (project supports `timestamptz` migrations) / SQLite (dev only)
- Node.js **18+** and npm **9+**

**Optional / integration services**
- **Pusher** account or self-hosted **Laravel WebSockets** server
- **SMTP** server (for password-reset OTP and notifications)
- **Redis** (recommended for cache / queue / broadcasting in production)

**Client browsers**
- Latest Chrome, Edge, Firefox, Safari (ES2020+, WebSockets, modern PDF/JS support)

---

## 3. Architecture Overview

```
┌─────────────────────────┐        HTTPS / WS        ┌────────────────────────┐
│  React 19 + TS SPA      │◄────────────────────────►│  Laravel 12 API + Web  │
│  (resources/js/src)     │   Sanctum tokens / cookie│  (app/, routes/)       │
│  Echo + Pusher client   │                          │  Sanctum, Policies     │
└─────────┬───────────────┘                          └─────┬──────────┬───────┘
          │ Pusher channels (private/presence)             │          │
          │                                                ▼          ▼
          │                                          ┌─────────┐ ┌────────────┐
          │                                          │ MySQL   │ │ Filesystem │
          │                                          └─────────┘ └────────────┘
          │                                                ▲
          │            ┌─────────────────┐                 │
          └───────────►│ Pusher / WS svc │◄──── broadcast ─┘
                       └─────────────────┘
```

**Tech stack**
- Backend: Laravel **^12.0**, Sanctum **^4.0**, Pusher PHP server **^7.2**
- Frontend: React **^19.2**, React Router **^7.13**, TypeScript **^5.9**, Vite **^7.0**, Tailwind **^3.4**, Laravel Echo **^1.11**, pusher-js **^8**, Recharts **^3.7**, pdfjs-dist **^5.6**, pptxgenjs **^4**
- Dev tooling: Pint (formatting), Pail (log viewer), PHPUnit **^11.5**, Faker

**Top-level layout**
```
app/             Laravel application code (Models, Http, Services, Events, …)
bootstrap/       Bootstrap entrypoints
config/          13 configuration files
database/        Migrations, seeders, factories
public/          Web entry, static assets
resources/       Blade templates, React SPA source, CSS
routes/          api.php, web.php (channels.php in providers)
scripts/         39 helper / debug PHP & shell scripts
storage/         Logs, cache, file uploads
tests/           PHPUnit Feature / Unit tests
user manual/     End-user documentation
Documentation/   System / architecture documentation (this folder)
```

---

## 4. Installation & Setup

### 4.1 Clone & install

```powershell
git clone <repo-url> maptech_initial
cd maptech_initial
composer install
npm install
```

### 4.2 Environment

```powershell
Copy-Item .env.example .env
php artisan key:generate
```

Edit `.env` and configure at minimum:

```dotenv
APP_NAME="Maptech LMS"
APP_ENV=local
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=maptech
DB_USERNAME=root
DB_PASSWORD=

BROADCAST_CONNECTION=pusher
PUSHER_APP_ID=
PUSHER_APP_KEY=
PUSHER_APP_SECRET=
PUSHER_APP_CLUSTER=ap1
VITE_PUSHER_APP_KEY="${PUSHER_APP_KEY}"
VITE_PUSHER_APP_CLUSTER="${PUSHER_APP_CLUSTER}"

MAIL_MAILER=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS="no-reply@maptech.local"

SANCTUM_STATEFUL_DOMAINS=localhost,localhost:5173
SESSION_DOMAIN=localhost
```

### 4.3 Database & assets

```powershell
php artisan migrate --seed
php artisan storage:link
npm run build      # production assets
# OR
npm run dev        # Vite dev server with HMR
```

### 4.4 One-shot dev runner

```powershell
composer run dev
```
Runs `php artisan serve`, `queue:listen`, `pail`, and `npm run dev` concurrently.

For broadcasting setup details, see [BROADCAST_SETUP.md](../BROADCAST_SETUP.md).

---

## 5. Configuration Reference

| File | Purpose |
|---|---|
| [config/app.php](../config/app.php) | App name, locale, timezone, providers |
| [config/auth.php](../config/auth.php) | Guards, providers, password timeout |
| [config/broadcasting.php](../config/broadcasting.php) | Pusher / WebSocket / log channels |
| [config/cache.php](../config/cache.php) | Cache stores (file, database, redis) |
| [config/cors.php](../config/cors.php) | Allowed origins, methods, credentials |
| [config/database.php](../config/database.php) | DB connections (mysql, pgsql, sqlite) |
| [config/filesystems.php](../config/filesystems.php) | Local / public / s3 disks |
| [config/logging.php](../config/logging.php) | Log channels, Pail integration |
| [config/mail.php](../config/mail.php) | Mailers, from address |
| [config/queue.php](../config/queue.php) | Queue connections (sync, database, redis) |
| [config/sanctum.php](../config/sanctum.php) | Stateful domains, token expiration |
| [config/services.php](../config/services.php) | Third-party service credentials |
| [config/session.php](../config/session.php) | Session driver, lifetime, domain |

**Key environment variables**

| Variable | Default | Notes |
|---|---|---|
| `APP_TIMEZONE` | `UTC` | Audit logs are stored as `timestamptz`; UI converts to user's local |
| `BROADCAST_CONNECTION` | `null` | Set to `pusher` to enable real-time |
| `SANCTUM_STATEFUL_DOMAINS` | – | Required for SPA cookie auth |
| `QUEUE_CONNECTION` | `database` | Use `redis` in production |
| `FILESYSTEM_DISK` | `local` | Use `public` for user-visible uploads |

---

## 6. Authentication & Security

### 6.1 Authentication modes

| Mode | Endpoint | Guard | Use case |
|---|---|---|---|
| **API token** | `POST /api/login` | `auth:sanctum` | SPA token-based requests, mobile clients |
| **Session** | `POST /login` | `web` | Cookie-bound SPA pages, time-log endpoints |
| **Read-only** | `ReadOnlyLoginController` | `web` | Audit-safe browsing without state writes |

### 6.2 Password reset (OTP)

Routes (`routes/api.php`, prefix `/api/password`):
- `POST /forgot` — issues 6-digit OTP via email
- `POST /verify-otp` — validates OTP, returns reset token
- `POST /reset` — accepts new password + token
- `POST /resend-otp` — re-sends OTP (rate-limited)
- `POST /reset-with-recovery-key` — recovery-key fallback (no email required)

OTP storage uses the `password_reset_tokens` table (extended by migration `2024_01_15_000001_add_otp_to_password_reset_tokens.php` and `2026_04_15_000001_fix_otp_column_size.php`).

### 6.3 Recovery key

Each user has `recovery_key` (display-once) and `recovery_key_hash` columns (migrations `2026_04_17_100000` and `100001`). Admin can regenerate a user's key at `POST /api/admin/users/{id}/regenerate-recovery-key`.

### 6.4 Hardening

- CSRF: `VerifyCsrfToken` middleware on the `web` group
- Cookie encryption: `EncryptCookies`
- Force JSON: `ForceJsonAccept` for API requests
- Account-status gate: `CheckAccountStatus` (`status` middleware) blocks suspended/disabled users
- Custom validation rules: [`MaptechEmail`](../app/Rules/MaptechEmail.php), [`StrongPassword`](../app/Rules/StrongPassword.php)
- CORS: configure `config/cors.php` allowed origins to match your SPA domain
- Recommended in production: HTTPS only, HSTS, `SECURE_COOKIE=true`, restrictive `SANCTUM_STATEFUL_DOMAINS`

---

## 7. Roles & Authorization (RBAC)

### 7.1 Roles

Stored on `users.role`: `Admin`, `Instructor`, `Employee` (case-insensitive comparisons in queries).

### 7.2 Middleware

| Middleware | Alias | Purpose |
|---|---|---|
| `AuthorizeRole` | `role:Admin\|Instructor\|Employee` | Restricts a route group to specified roles |
| `DepartmentAccess` | `dept` | Limits scope to user's department / subdepartment |
| `CheckAccountStatus` | `status` | Blocks suspended accounts |

### 7.3 Policies

- [`CustomModulePolicy`](../app/Policies/CustomModulePolicy.php) — view / create / update / delete / push for `CustomModule`

### 7.4 Department scoping

- `users.department` (string) and `users.subdepartment_id` (FK) determine scope
- `Subdepartment` has `head_id`, `employee_id`, and many `employees`
- Many admin endpoints filter by these fields to prevent cross-department leakage

---

## 8. Domain Model / Data Dictionary

Located in [app/Models](../app/Models). Each model uses Eloquent with timestamps unless noted.

### 8.1 Identity & org

| Model | Key fields | Relationships |
|---|---|---|
| `User` | `fullname`, `email`, `password`, `role`, `department`, `subdepartment_id`, `status`, `profile_picture`, `signature_path`, `recovery_key_hash`, `personal_gmail`, `company_role` | hasMany `CourseEnrollment`, `AuditLog`, `TimeLog`, `QuizAttempt`; belongsTo `Subdepartment` |
| `Department` | `name`, `code`, `head_id`, `status`, `description`, `employee_count`, `course_count` | belongsTo `headUser`; hasMany `Subdepartment` |
| `Subdepartment` | `department_id`, `name`, `head_id`, `employee_id`, `description` | belongsTo `Department`, `headUser`, `employee`; hasMany `employees` |

### 8.2 Course content

| Model | Key fields | Notes |
|---|---|---|
| `Course` | `title`, `description`, `status`, `start_date`, `deadline`, `logo`, `subdepartment_id`, `instructor_id` | hasMany `Module`, `CourseEnrollment` |
| `Module` | `course_id`, `title`, `order`, `pre_assessment`, `content_path` (nullable), `description`, `logo_path`, `custom_module_id` | hasMany `Lesson`, `Quiz`; belongsToMany `User` via `module_user` (unlock) |
| `Lesson` | `module_id`, `title`, `text_content`, `video_url`, `file_path` | hasMany `Question`, `LessonFeedback`, `LessonEvent` |
| `CustomModule` | `title`, `description`, `is_ui_component`, `ui_metadata` | hasMany `CustomLesson`, `CustomModuleVersion`; pivot `custom_module_user_assignments` |
| `CustomLesson` | `custom_module_id`, content fields | child of `CustomModule` |
| `CustomModuleVersion` | snapshot of a `CustomModule` for rollback / audit |

### 8.3 Quizzes & assessments

| Model | Key fields | Notes |
|---|---|---|
| `Quiz` | `module_id`, `lesson_id`, `title`, `passing_score` | hasMany `QuizQuestion`, `QuizAttempt`, `QuizFeedback` |
| `QuizQuestion` | `quiz_id`, `text`, `type` | hasMany `QuizOption` |
| `QuizOption` | `quiz_question_id`, `text`, `is_correct` | |
| `QuizAttempt` | `user_id`, `quiz_id`, `score`, `answers`, `submitted_at` | |
| `QuizFeedback` / `QuizFeedbackReply` | quiz-level feedback thread | |

### 8.4 Enrollment & progress

| Model | Key fields |
|---|---|
| `CourseEnrollment` | `user_id`, `course_id`, `status`, `progress`, `locked`, `unlocked_until` |
| `Enrollment` | legacy / parallel enrollment table (kept for compatibility) |
| `module_user` (pivot) | `module_id`, `user_id`, `unlocked_until` (time-limited unlock) |
| `Certificate` | `user_id`, `course_id`, `issued_at`, `logo_path`, signature meta |

### 8.5 Communication

| Model | Purpose |
|---|---|
| `Question`, `QuestionReply`, `QuestionReplyReaction` | Lesson-level Q&A |
| `LessonFeedback`, `LessonFeedbackReply` | Lesson feedback threads |
| `LessonEvent` | Per-lesson playback / interaction events |
| `Notification` | In-app notifications with `targets` JSON (department/user) |
| `SentHistory` | Record of admin-sent announcements |

### 8.6 Operations

| Model | Purpose |
|---|---|
| `AuditLog` | Action, `user_id`, `ip_address`, `created_at` (timestamptz), session-link columns |
| `TimeLog` | `user_id`, `time_in`, `time_out`, `login_audit_log_id`, `logout_audit_log_id`, `archived` |
| `BusinessDetail` | Company name, contact, VAT, TIN, mobile, branding |
| `ProductLogo` | Course-bound branding logos |

---

## 9. Database

- **86 migrations** in [database/migrations](../database/migrations) — see directory listing for full chronology.
- **Seeders** in [database/seeders](../database/seeders): `DatabaseSeeder`, `CourseEnrollmentSeeder`, `TimeLogSeeder`.
- **Factories**: `UserFactory`.

### 9.1 Notable migration milestones

| Date prefix | Change |
|---|---|
| `2026_02_*` | Base users + roles + Sanctum tokens + departments |
| `2026_03_02` … `2026_03_06` | Course / Module / Lesson / Question / Reply tables |
| `2026_03_09` | Certificates, audit logs, `instructor_id`→`employee_id` rename on subdepartments |
| `2026_03_12` | Time logs, quiz feedback, locked enrollments, `targets` on notifications, `module_user` pivot |
| `2026_03_19` | Force `timestamptz` on time-sensitive columns |
| `2026_03_25` | Product logos, business details + contact/VAT/TIN fields |
| `2026_04_01` | Custom modules + versions + UI-component fields + session-link columns |
| `2026_04_10` | `sent_history`, soft-deletes on notifications & audit logs |
| `2026_04_17` | Recovery-key hash columns, sent_history extras |

### 9.2 Snapshot & restore

- `database.sql` and `dsad.sql` in the repo root contain SQL snapshots (use for local restore only — do not commit production data).

---

## 10. API Reference

All API endpoints live in [routes/api.php](../routes/api.php). Authenticated endpoints require `Authorization: Bearer <token>` (Sanctum) unless otherwise noted. Admin/instructor/employee groups apply `auth:sanctum`, `status`, and `role:<Role>` middleware.

### 10.1 Public

| Method | Path | Description |
|---|---|---|
| POST | `/api/password/forgot` | Send OTP |
| POST | `/api/password/verify-otp` | Verify OTP |
| POST | `/api/password/reset` | Reset password with token |
| POST | `/api/password/resend-otp` | Resend OTP |
| POST | `/api/password/reset-with-recovery-key` | Reset using recovery key |
| GET | `/api/departments` | List departments + subdepartments + counts |
| POST | `/api/departments` | Create department |
| PUT | `/api/departments/{id}` | Update department |
| DELETE | `/api/departments/{id}` | Delete department |
| POST | `/api/departments/{id}/subdepartments` | Create subdepartment |
| PUT | `/api/subdepartments/{id}` | Update subdepartment |
| DELETE | `/api/subdepartments/{id}` | Delete subdepartment |
| POST | `/api/login` | API token login |
| GET | `/api/business-details` | Public branding info |

### 10.2 Authenticated (any role)

| Method | Path | Description |
|---|---|---|
| GET | `/api/user` | Current user profile |
| POST | `/api/logout` | Revoke current token |
| GET | `/api/me/audit-logs` | Current user's audit log + linked time-logs |
| GET | `/api/test-auth` | Diagnostic endpoint |

### 10.3 Admin (`/api/admin/*`)

- **Dashboard**: `GET /dashboard`, `GET /activity`
- **Reports**: `GET /reports`, `GET /reports/export`, `GET /reports/analytics`
- **Users**: `GET|POST /users`, `GET|PUT|DELETE /users/{id}`, `POST /users/{id}/photo`, `GET /users/{id}/recovery-key`, `POST /users/{id}/regenerate-recovery-key`, `POST /users/bulk-delete`
- **Courses**: `GET|POST /courses`, `GET|PUT|DELETE /courses/{id}`, `POST /courses/bulk-assign`
- **Enrollments**: `GET /enrollments`, mismatch checks, lock/unlock at course or module level
- **Custom Modules**: CRUD + push-to-courses + sync triggers
- **Quizzes**: CRUD on questions/options, feedback threads
- **Notifications**: send, list, soft-delete
- **Business Details**: `POST /business-details`
- **Audit Logs**: list, filter, export

### 10.4 Instructor (`/api/instructor/*`)

- **Courses**: list assigned, view, manage enrollments
- **Quizzes**: create/update on owned lessons
- **Custom Modules**: view modules pushed into owned courses

### 10.5 Employee (`/api/employee/*`)

- **Dashboard**: overview & stats
- **Courses**: enrolled list, course detail with modules/lessons
- **Quizzes**: take, list attempts
- **Certificates**: download
- **Feedback**: submit / view on lessons & quizzes
- **Custom Modules**: view assigned

### 10.6 Conventions

- Errors: standard Laravel JSON validation envelope `{ "message": "...", "errors": { field: [..] } }`
- Pagination: Laravel paginator JSON shape (`data`, `links`, `meta`) where applied
- Timestamps: ISO-8601 UTC; client converts to local timezone (audit log payload uses `AuditDate::modelFieldUtcIso`)

---

## 11. Web Routes

[routes/web.php](../routes/web.php) — session-bound endpoints for the SPA shell and integrations.

| Method | Path | Notes |
|---|---|---|
| GET | `/` | Serves React SPA (`welcome.blade.php`) |
| GET | `/login` | Serves SPA (client-side route) |
| POST | `/login` | Session login |
| POST | `/logout` | Session logout (auth) |
| GET | `/user` | Session user info (auth) |
| GET | `/api/time-logs/me` | My time logs (session) |
| POST | `/api/time-logs/punch-in` | Punch in (session) |
| POST | `/api/time-logs/punch-out` | Punch out (session) |

**Console routes**: `routes/console.php` (custom artisan commands).

**Broadcast channels**: registered via `BroadcastServiceProvider`. Channel naming convention: `private-user.{id}`, `private-course.{id}`, `private-notifications.{id}`.

---

## 12. Frontend Architecture

Source: [resources/js/src](../resources/js/src). Built with Vite + Laravel Vite Plugin.

### 12.1 Layout

```
src/
  pages/        Route-level screens grouped by role
    admin/
    instructor/
    employee/
    auth/       Login, ForgotPassword, VerifyOTP, ResetPassword
  components/
    layouts/    AdminLayout, InstructorLayout, EmployeeLayout
    common/     Modals, ToastProvider, ErrorBoundary, NotificationBell
    content/    PDFViewer, PresentationViewer, RichTextEditor
    qna/        LessonQnA, FeedbackList
    timelog/    UserTimeLog
    business/   BusinessDetailsForm
  hooks/        useBusinessDetails, useConfirm, usePrompt
  utils/        api client, formatting, auth helpers
  echo.ts       Laravel Echo + Pusher init
  main.tsx      App root
```

### 12.2 Routing

- React Router **^7.13** with role-aware route guards
- Public: `/login`, `/forgot-password`, `/verify-otp`, `/reset-password`
- `/admin/*`, `/instructor/*`, `/employee/*` shells, each with nested routes

### 12.3 State & data

- HTTP via `axios` with bearer-token interceptor
- Local state via React hooks; ad-hoc context where needed (Toast, Confirm/Prompt)
- Real-time subscriptions in `echo.ts` push directly into component state

### 12.4 Build pipeline

- `npm run dev` — Vite HMR; SPA assets injected by `@vite` directive in `welcome.blade.php`
- `npm run build` — emits to `public/build/`
- Tailwind 3.4 + PostCSS pipeline configured in `tailwind.config.js` and `postcss.config.js`

---

## 13. Real-Time / Broadcasting

See [BROADCAST_SETUP.md](../BROADCAST_SETUP.md) for full setup. Summary below.

### 13.1 Driver

- Default: **Pusher** (`pusher/pusher-php-server` server-side, `pusher-js` + `laravel-echo` client-side)
- Self-hosted alternative: Laravel WebSockets

### 13.2 Channels (private)

| Channel | Purpose |
|---|---|
| `user.{id}` | Per-user notifications, profile updates |
| `course.{id}` | Course-wide content sync, enrollment changes |
| `notifications.{id}` | Notification count + new-item events |

### 13.3 Events

| Event | Trigger |
|---|---|
| `AuditLogCreated` | Any tracked action via `audit.php` helper |
| `ContentSynced` | `ContentSyncService::push()` |
| `CustomModuleUpdated` | Save on `CustomModule` (queues `SyncCustomModuleToCourses`) |
| `EnrollmentUnlocked` | Admin/Instructor unlocks course |
| `ModuleUnlocked` | Admin grants time-limited module access |
| `NotificationCreated` | New `Notification` row |
| `NotificationCountUpdated` | Notification mark-read changes |
| `TimeLogUpdated` | Punch in / punch out |

### 13.4 Listener

- `SyncCustomModuleToCourses` — receives `CustomModuleUpdated`, propagates to dependent `Module` rows and emits `ContentSynced`.

---

## 14. Content Sync System

Authoritative reference: [CONTENT_SYNC_SYSTEM.md](../CONTENT_SYNC_SYSTEM.md).

**Flow**
1. Admin edits a `CustomModule` (or a UI-component-flagged custom module) in the SPA builder.
2. Save triggers `CustomModuleUpdated` event.
3. `SyncCustomModuleToCourses` listener iterates all `Module` rows that reference the custom module via `custom_module_id`.
4. `CustomModuleSyncService` updates module/lesson content; `ContentSyncService` writes a `CustomModuleVersion` snapshot.
5. `ContentSynced` event broadcasts on each `course.{id}` channel; `NotificationCreated` events alert affected users.
6. Frontend Echo handlers refetch course data and toast the user.

**Versioning** — every sync writes a `CustomModuleVersion` row capturing the previous payload, supporting audit and future rollback.

---

## 15. Custom UI Components

Authoritative reference: [CUSTOM_UI_COMPONENTS.md](../CUSTOM_UI_COMPONENTS.md).

- Admin-only Sidebar Module Builder (`pages/admin/CustomModuleBuilder`)
- A `CustomModule` flagged with `is_ui_component=true` becomes a sidebar module instead of a course module
- `ui_metadata` JSON column stores layout, icon, route, role visibility
- Authorization via `CustomModulePolicy`

---

## 16. Course & Enrollment Lifecycle

```
[Draft] → [Published] → [Enrolled users] → [In Progress] → [Completed] → [Certificate]
                            │
                            └── Locked / Unlocked (time-limited) per module or whole course
```

**Key behaviors**
- Course `status` controls visibility (Draft / Published / Archived)
- `start_date` and `deadline` gate availability
- Modules have `order` and an optional `pre_assessment` quiz that must be passed to unlock subsequent lessons
- `module_user.unlocked_until` enables time-limited unlocks (see `run_time_limited_unlock_test.php`)
- `CourseEnrollment.locked` allows admin/instructor to suspend access without unenrolling
- Progress is computed from completed lessons + passed quizzes
- On full completion, a `Certificate` row is created and a PDF is generated using the user's signature, course logo, and business branding

**Bulk operations**
- `POST /api/admin/courses/bulk-assign` — assign multiple courses to an instructor
- `POST /api/admin/users/bulk-delete` — bulk delete users

---

## 17. Quiz & Assessment

- **Question types**: multiple choice (single correct) via `QuizOption.is_correct`
- **Pre-assessment quizzes**: gate further module access when `Module.pre_assessment=true`
- **Attempts**: `QuizAttempt` stores per-attempt `answers` and computed `score`
- **Locking**: per-user lock can prevent retakes until admin reset
- **Feedback loop**: `QuizFeedback` and `QuizFeedbackReply` for instructor ↔ employee discussion
- **Admin tools**: scripts under `scripts/` (`fix_all_quiz_answers.php`, `list_all_quiz_questions.php`, etc.)

---

## 18. Q&A and Feedback

- **Lesson Q&A**: `Question` (one per lesson thread starter), `QuestionReply` (threaded), `QuestionReplyReaction` (likes)
- **Lesson Feedback**: `LessonFeedback` + `LessonFeedbackReply`
- **Lesson Events**: `LessonEvent` records views, completions, and playback milestones for analytics
- **Quiz Feedback**: `QuizFeedback` + `QuizFeedbackReply`

---

## 19. Notifications

- Stored in `notifications` (soft-deletable since `2026_04_10`)
- `targets` JSON column supports targeting specific users, departments, or roles
- Real-time delivery via `NotificationCreated` and `NotificationCountUpdated` events on `notifications.{id}` channel
- Frontend `NotificationBell` listens, increments badge, surfaces toast
- Admin can dispatch announcements; sent records archived in `sent_history` (with `announcement_mode`, `subdepartment_id`, `data` JSON)

---

## 20. Time Tracking

Endpoints (session-authenticated, `routes/web.php`):

| Method | Path | Action |
|---|---|---|
| GET | `/api/time-logs/me` | List my time-logs |
| POST | `/api/time-logs/punch-in` | Start session |
| POST | `/api/time-logs/punch-out` | End session |

**Linkage to audit**
- `TimeLog.login_audit_log_id` and `logout_audit_log_id` deterministically link to `AuditLog` rows for the same session.
- Legacy fallback: time-window match (±2 min) when explicit IDs are missing — see `routes/api.php` (`/me/audit-logs`).
- `archived` flag (since `2026_03_13`) hides historical logs without deleting.

---

## 21. Audit Logging

- Helper: [app/Helpers/audit.php](../app/Helpers/audit.php) (autoloaded via composer `files`)
- Date helper: [app/Support/AuditDate.php](../app/Support/AuditDate.php) — converts model timestamps to UTC ISO-8601 for API output
- Storage: `audit_logs` (timestamptz, soft-deletes since `2026_04_10`)
- Tracked actions include: `login`, `logout`, course/module create/update/delete, enrollment lock/unlock, custom module push, password reset, user CRUD
- Broadcast: `AuditLogCreated` event (admin dashboards stream live)
- Endpoints: `GET /api/me/audit-logs` (own), `GET /api/admin/activity` (all)

---

## 22. File Handling & Integrations

### 22.1 Storage

- Disks defined in `config/filesystems.php` (`local`, `public`, optional `s3`)
- User uploads (profile picture, signature, course logos, lesson files) routed through `public` disk
- `public/storage` symlink created via `php artisan storage:link`

### 22.2 File conversion

- [`FileConversionService`](../app/Services/FileConversionService.php) wraps PDF ↔ PPTX conversions used by lesson uploads
- Frontend uses `pdfjs-dist` and `pptxgenjs` for previews and client-side conversion (see `PdfToPptxConverter` component)

---

## 23. Mail & OTP

- Mailables: [`PasswordResetOTPMail`](../app/Mail/PasswordResetOTPMail.php), [`PasswordResetSuccessMail`](../app/Mail/PasswordResetSuccessMail.php)
- Templates under `resources/views/emails/`
- Configure via `MAIL_*` env variables (`config/mail.php`)
- OTP rate limiting handled inside `PasswordResetController`

---

## 24. Background Jobs & Queue

- Driver: configured in `config/queue.php` (`database` default; `redis` recommended for production)
- Worker: `php artisan queue:work` (or `queue:listen` in dev via `composer run dev`)
- Queued work currently: `SyncCustomModuleToCourses` listener (and any future mail / sync jobs)
- Failed jobs: `php artisan queue:failed`, `php artisan queue:retry all`

---

## 25. Operational Scripts

The repository includes ~39 helper scripts in [scripts/](../scripts) plus root-level utilities. **Do not run in production without review.**

**Categories**
- **Admin/User**: `create_admin_account.php`, `get_admin_accounts.php`, `inspect_users_columns.php`, `count_users.php`, `add_instructor_column.php`
- **Database checks**: `check_laravel_db.php`, `show_enrollment_constraints.php`, `inspect_subdepartments.php`
- **Auth**: `auth_test.php`, `test_cookie_login.php`, `test_token_request.php`, `create_token.php`
- **Time logs**: `seed_user_timelog.php`, `delete_timelog.php`
- **Quizzes**: `fix_all_quiz_answers.php`, `fix_quiz_answers.php`, `list_all_quiz_questions.php`
- **Audit**: `fetch_audit_logs.ps1`, `smoke_notify_check.php`, `smoke_notify_dump.php`, `verify_unlock.js`, `verify_unlock.sh`
- **Notifications**: `send_announce.php`, `list_notifications.php`
- **Simulations**: `simulate_unlock_dept_all.php`, `test_preview.php`

**Root-level helpers**
- `check_constraint.php`, `check_department_mismatch.php`, `check_users.php`
- `run_fetch_me_audit_logs.php`, `run_time_limited_unlock_test.php`, `run_tinker_user1.php`, `run_unlock_and_fetch_course.php`
- `seed_modules_with_quiz.php`, `test_api.php`

---

## 26. Testing

- Framework: PHPUnit **^11.5** (`phpunit.xml`)
- Locations: [tests/Feature](../tests/Feature), [tests/Unit](../tests/Unit)
- Run: `composer test` (clears config, runs `php artisan test`)
- Current coverage is minimal (`ExampleTest`); recommended additions:
  - Auth flow (login, logout, OTP reset, recovery key)
  - RBAC route guards (Admin/Instructor/Employee endpoint reachability matrix)
  - Enrollment lock/unlock + time-limited unlock expiry
  - Quiz scoring and pre-assessment gating
  - Audit-log creation for tracked actions
  - Broadcast event dispatch (`Event::fake`)

---

## 27. Deployment

### 27.1 Build for production

```powershell
composer install --no-dev --optimize-autoloader
npm ci
npm run build
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
php artisan storage:link
php artisan migrate --force
```

### 27.2 Web server

- **Apache**: use included `public/.htaccess`; `DocumentRoot` → `public/`
- **Nginx**: standard Laravel recipe pointing to `public/index.php`

### 27.3 Long-running processes

| Process | Command | Run via |
|---|---|---|
| Queue worker | `php artisan queue:work --sleep=3 --tries=3 --timeout=120` | systemd / Supervisor |
| Scheduler | `* * * * * php artisan schedule:run` | cron |
| WebSockets (if self-hosting) | `php artisan websockets:serve` | systemd / Supervisor |

### 27.4 Production checklist

- [ ] `APP_ENV=production`, `APP_DEBUG=false`
- [ ] HTTPS enforced; `SECURE_COOKIE=true`
- [ ] `SANCTUM_STATEFUL_DOMAINS` and `SESSION_DOMAIN` set to production host
- [ ] `BROADCAST_CONNECTION=pusher` with valid keys
- [ ] `QUEUE_CONNECTION=redis` and Redis reachable
- [ ] Mail credentials verified (send test OTP)
- [ ] Storage disk writable; `storage:link` executed
- [ ] DB user limited to required privileges
- [ ] Firewall: only 80/443 (and WebSockets port if self-hosted) public

---

## 28. Backup & Recovery

- **Database**: nightly `mysqldump` (or `pg_dump`) → encrypted off-site storage; retain ≥ 30 days
- **Storage uploads**: rsync / cloud bucket sync of `storage/app/public`
- **Recovery keys**: stored hashed (`recovery_key_hash`); regenerate via admin UI if compromised — display-once
- **Configuration**: keep `.env` and `config/` snapshots in a secrets manager (e.g., Vault, Azure Key Vault)
- **Restore drill**: quarterly — restore latest dump into staging, run smoke tests (`scripts/smoke_notify_check.php`, `run_fetch_me_audit_logs.php`)

---

## 29. Troubleshooting & FAQ

| Symptom | Likely cause | Fix |
|---|---|---|
| 419 / CSRF mismatch on SPA login | `SANCTUM_STATEFUL_DOMAINS` mis-set or cookie domain mismatch | Align `SESSION_DOMAIN`, `SANCTUM_STATEFUL_DOMAINS`, `APP_URL` |
| Real-time events not firing | `BROADCAST_CONNECTION=null` or wrong Pusher cluster | Set Pusher env vars; verify with `php artisan tinker` → `event(new …)` |
| Queue jobs never run | No worker running | Start `php artisan queue:work` (use Supervisor in prod) |
| File-conversion failures | Missing PHP extensions or oversized upload | Enable `gd`/`imagick`; raise `upload_max_filesize`, `post_max_size` |
| Enrollment count mismatch | Stale department string vs subdepartment FK | Run `check_department_mismatch.php` and reconcile |
| Audit-log timestamps off | Server timezone vs `timestamptz` mismatch | Confirm DB column is `timestamptz`; rely on `AuditDate` helpers |
| OTP emails not arriving | SMTP credentials / spam filter | Test with Mailtrap; check `storage/logs/laravel.log` |
| `storage:link` 404s in browser | Symlink missing on deploy | Re-run `php artisan storage:link` |

---

## 30. Maintenance & Upgrade

### 30.1 Routine

- Weekly: review failed jobs, audit-log spikes, queue depth
- Monthly: dependency updates (`composer update`, `npm update`) in a staging branch; re-run tests
- Quarterly: rotate Pusher keys, regenerate any compromised recovery keys, restore-from-backup drill

### 30.2 Database changes

- Always create a migration (`php artisan make:migration ...`) — never mutate the schema by hand
- For production: `php artisan migrate --force`
- Custom-module schema changes must include a `CustomModuleVersion` migration plan to preserve history

### 30.3 Upgrading Laravel

1. Read official upgrade guide for the target minor version
2. Update `composer.json` constraint, run `composer update` in a feature branch
3. Run full test suite; smoke-test SPA against API in staging
4. Re-cache config/routes/views in production after deploy

### 30.4 Frontend upgrades

- React / Vite / Tailwind majors: bump in feature branch, run `npm run build`, exercise all role dashboards
- Watch breaking changes for `react-router-dom` v7+ data-routing APIs

---

## Appendix A — Useful Commands

```powershell
# Dev (concurrent: server, queue, logs, vite)
composer run dev

# Run tests
composer test

# Tinker
php artisan tinker

# Tail logs (Pail)
php artisan pail

# Clear caches
php artisan optimize:clear

# Re-build & cache for production
php artisan optimize
```

## Appendix B — Cross-References

- [README.md](../README.md)
- [BROADCAST_SETUP.md](../BROADCAST_SETUP.md)
- [CONTENT_SYNC_SYSTEM.md](../CONTENT_SYNC_SYSTEM.md)
- [CUSTOM_UI_COMPONENTS.md](../CUSTOM_UI_COMPONENTS.md)
- [CODEBASE_EXPLORATION_REPORT.md](../CODEBASE_EXPLORATION_REPORT.md)
- [user manual/USER_MANUAL.md](../user%20manual/USER_MANUAL.md)
