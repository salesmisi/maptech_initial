# Maptech LMS System Analysis Pack

> Generated from the current Laravel codebase, migrations, models, and route surface in this repository.
> Scope: core business entities, operational tables, and the major application flows exposed by the system.

## 1. System Snapshot

Maptech LMS is a role-based learning management platform with three primary user groups:

- Admin: manages users, departments, courses, custom modules, branding, logs, and notifications.
- Instructor: manages assigned courses, content, quizzes, and learner support.
- Employee: enrolls in courses, consumes lessons, takes quizzes, receives certificates, and tracks progress.

The platform also includes real-time notifications, content synchronization, audit logging, time tracking, certificate generation, recovery-key password reset, and custom UI component modules.

## 2. Core Domain Areas

| Domain | Main Tables |
|---|---|
| Identity and organization | users, departments, subdepartments, user_subdepartment |
| Learning delivery | courses, modules, lessons, enrollments, module_user, quizzes, quiz_questions, quiz_options, quiz_attempts, certificates |
| Q&A and feedback | questions, question_replies, question_reply_reactions, lesson_feedbacks, lesson_feedback_replies, quiz_feedbacks, quiz_feedback_replies |
| Operations and messaging | notifications, audit_logs, time_logs, sent_history |
| Branding and content sync | business_details, product_logos, custom_modules, custom_lessons, custom_module_versions, custom_module_user_assignments |

## 3. ERD

![Diagram 01](../images/diagram-01.png)

## 4. Data Dictionary

### 4.1 Identity and Organization

| Table | Purpose | Key Columns | Notes |
|---|---|---|---|
| users | System accounts and role-based access | fullname, email, password, role, department, subdepartment_id, company_role, personal_gmail, status, profile_picture, signature_path, recovery_key_hash | Supports Admin, Instructor, and Employee roles. |
| departments | Top-level business divisions | name, code, head_id, status, description, employee_count, course_count | Head must be an Admin or Instructor. |
| subdepartments | Department subdivisions | department_id, name, description, head_id, employee_id | Can have both a head and a direct employee owner. |
| user_subdepartment | Instructor-to-subdepartment assignment bridge | user_id, subdepartment_id | Many-to-many relationship for instructors and subdepartments. |

### 4.2 Learning Delivery

| Table | Purpose | Key Columns | Notes |
|---|---|---|---|
| courses | Training units owned by a department and instructor | id, title, description, department, subdepartment_id, instructor_id, status, start_date, deadline, logo_path | Uses UUID primary key. |
| modules | Ordered sections within a course | id, course_id, custom_module_id, title, description, content_path, logo_path, order | Can be synced from a custom module. |
| lessons | Atomic learning content inside a module | id, module_id, custom_lesson_id, title, type, text_content, content_path, duration, file_size, status, order | Supports text, video, file, and linked content. |
| enrollments | User enrollment and progress tracking | user_id, course_id, status, progress, enrolled_at, locked | Unique per user-course pair. |
| module_user | Manual unlock pivot for users and modules | module_id, user_id, unlocked, unlocked_at, unlocked_until | Controls time-limited unlock rules. |
| quizzes | Quiz definition and passing threshold | course_id, module_id, title, description, pass_percentage | One module can have one quiz. |
| quiz_questions | Questions within a quiz | quiz_id, question_text, image_path, video_path, order | Questions are ordered per quiz. |
| quiz_options | Answer choices per quiz question | question_id, option_text, is_correct, order | Stores correctness at the option level. |
| quiz_attempts | Learner quiz submissions | user_id, quiz_id, score, total_questions, percentage, passed | Drives progress and certificate generation. |
| certificates | Completion evidence for a course | user_id, course_id, certificate_code, completed_at, score, logo_path | Generated automatically when completion criteria are met. |

### 4.3 Q&A and Feedback

| Table | Purpose | Key Columns | Notes |
|---|---|---|---|
| questions | Course and lesson questions from users | user_id, course_id, lesson_id, question, answer, answered_by, answered_at | Supports instructor response tracking. |
| question_replies | Conversation thread under a question | question_id, user_id, message | Ordered in ascending creation order. |
| question_reply_reactions | Emoji reactions to replies | reply_id, user_id, emoji | Unique per reply, user, emoji triplet. |
| lesson_feedbacks | Lesson-level learner ratings and comments | user_id, lesson_id, rating, comment | Unique per user and lesson. |
| lesson_feedback_replies | Responses to lesson feedback | lesson_feedback_id, user_id, comment | Used by instructors/admins. |
| quiz_feedbacks | Quiz-level learner ratings and comments | user_id, quiz_id, rating, comment | Feedback capture after quiz interactions. |
| quiz_feedback_replies | Responses to quiz feedback | quiz_feedback_id, user_id, comment | Used for follow-up discussion. |

### 4.4 Operations and Messaging

| Table | Purpose | Key Columns | Notes |
|---|---|---|---|
| notifications | In-app notification feed | user_id, course_id, module_id, type, title, message, data, read_at | Broadcasts real-time updates and unread counts. |
| audit_logs | Immutable security and activity log | user_id, action, ip_address, session_key, created_at, deleted_at | Soft deletes supported for retention management. |
| time_logs | Punch-in / punch-out tracking | user_id, session_key, login_audit_log_id, logout_audit_log_id, time_in, time_out, note, archived | Linked to audit logs for session traceability. |
| sent_history | Announcement delivery history | sender_id, title, message, target, announcement_mode, data, target_roles, department_id, subdepartment_id, recipients_count, deleted_at | Keeps recent sends with retention trimming. |

### 4.5 Branding and Content Sync

| Table | Purpose | Key Columns | Notes |
|---|---|---|---|
| business_details | Organization branding and contact profile | company_name, logo_path, email, phone, mobile_phone, country, address, website, vat_reg_tin | Used in certificate and business identity screens. |
| product_logos | Course/module/lesson logo mappings | name, file_path, course_id, module_id, lesson_id | Legacy-compatible branding fallback. |
| custom_modules | Reusable admin-authored content blocks | title, module_type, route_path, icon_name, component_config, category, tags, thumbnail_path, status, order, created_by, updated_by, version | Supports learning modules and admin-only UI components. |
| custom_lessons | Lesson assets within a custom module | custom_module_id, title, description, content_type, text_content, content_path, content_url, file_name, file_type, file_size, duration, quiz_id, order, status | Can map to a quiz or external link. |
| custom_module_versions | Version history for custom modules | custom_module_id, version_number, title, description, lessons_snapshot, changes, created_by, created_at | Stores snapshots for audit and rollback. |
| custom_module_user_assignments | Assignment bridge for custom module access | custom_module_id, user_id, assigned_by, assigned_at | Tracks who assigned the module and when. |

## 5. Business Requirements

| BR ID | Requirement | Primary Actors | Outcome |
|---|---|---|---|
| BR-01 | The system must authenticate users and route them by role. | Admin, Instructor, Employee | Secure access to the correct dashboard and APIs. |
| BR-02 | The system must support department and subdepartment hierarchy management. | Admin | Organize users and training scope by business structure. |
| BR-03 | The system must allow instructors and admins to create and manage courses, modules, and lessons. | Admin, Instructor | Provide structured learning content. |
| BR-04 | The system must track enrollments, progress, and course completion. | Admin, Instructor, Employee | Show current learning status and completion progress. |
| BR-05 | The system must support quizzes, scoring, and pass/fail evaluation. | Admin, Instructor, Employee | Measure learning mastery. |
| BR-06 | The system must generate certificates automatically upon completion. | Employee, Admin | Provide proof of course completion. |
| BR-07 | The system must support learner Q&A and feedback workflows. | Instructor, Employee | Enable support and continuous improvement. |
| BR-08 | The system must provide real-time notifications and content sync. | Admin, Instructor, Employee | Keep users updated without refresh cycles. |
| BR-09 | The system must record audit logs and time logs for accountability. | Admin, Employee | Maintain compliance and session traceability. |
| BR-10 | The system must support custom modules, versioning, and UI components. | Admin | Allow reusable content and admin-only UI customization. |
| BR-11 | The system must support OTP and recovery-key password reset. | All users | Recover access securely. |
| BR-12 | The system must store branding details and logo mappings for certificates and content. | Admin | Keep organization branding consistent. |

## 6. Requirement List

| FR ID | Functional Requirement | Related Tables |
|---|---|---|
| FR-01 | Users can log in, log out, and obtain an authenticated session or token. | users, personal_access_tokens, sessions |
| FR-02 | The system can enforce role-based authorization across pages and APIs. | users, departments, subdepartments |
| FR-03 | Admin can create, update, and delete departments and subdepartments. | departments, subdepartments |
| FR-04 | Admin and instructors can create, update, and manage courses. | courses, users |
| FR-05 | Courses can contain ordered modules and lessons. | courses, modules, lessons |
| FR-06 | Employees can enroll in courses and see progress status. | enrollments, courses |
| FR-07 | Modules can be manually unlocked for users and can also have unlock windows. | module_user, enrollments | 
| FR-08 | Courses can contain quizzes with ordered questions and options. | quizzes, quiz_questions, quiz_options |
| FR-09 | Quiz attempts are recorded and can be used to determine course progress. | quiz_attempts, enrollments |
| FR-10 | Certificates are generated when a course is completed. | certificates, quiz_attempts, quizzes |
| FR-11 | Users can ask questions and receive threaded replies and reactions. | questions, question_replies, question_reply_reactions |
| FR-12 | Users can submit lesson and quiz feedback. | lesson_feedbacks, lesson_feedback_replies, quiz_feedbacks, quiz_feedback_replies |
| FR-13 | Notifications are created and updated in real time. | notifications |
| FR-14 | Audit actions and time logs are stored with timezone-aware timestamps. | audit_logs, time_logs |
| FR-15 | Admins can create and sync custom modules to courses. | custom_modules, custom_lessons, custom_module_versions, modules, lessons |
| FR-16 | Admin-only UI component modules can be published into the sidebar. | custom_modules |
| FR-17 | The system stores business branding and logo assets. | business_details, product_logos |
| FR-18 | Announcement history is retained and automatically cleaned up when limits are exceeded. | sent_history |
| FR-19 | Password reset must support OTP and recovery-key flows. | password_reset_tokens, users |
| FR-20 | The system must expose department and course data for dashboards and content pages. | departments, courses, modules, enrollments |

## 7. RTM

| BR ID | Mapped FR IDs | Main Tables | Suggested Test Cases |
|---|---|---|---|
| BR-01 | FR-01, FR-02 | users, sessions, personal_access_tokens | TC-01, TC-02 |
| BR-02 | FR-03 | departments, subdepartments | TC-03 |
| BR-03 | FR-04, FR-05 | courses, modules, lessons | TC-04 |
| BR-04 | FR-06, FR-07, FR-09 | enrollments, module_user, quiz_attempts | TC-05, TC-06 |
| BR-05 | FR-08, FR-09, FR-10 | quizzes, quiz_questions, quiz_options, quiz_attempts, certificates | TC-06, TC-07 |
| BR-06 | FR-11, FR-12 | questions, replies, feedback tables | TC-08 |
| BR-07 | FR-13 | notifications | TC-09 |
| BR-08 | FR-14 | audit_logs, time_logs | TC-10 |
| BR-09 | FR-15, FR-16 | custom_modules, custom_lessons, custom_module_versions, modules, lessons | TC-11, TC-12 |
| BR-10 | FR-17, FR-18, FR-19 | business_details, product_logos, sent_history, password_reset_tokens | TC-13, TC-14 |

## 8. Test Cases

| TC ID | Scenario | Preconditions | Steps | Expected Result |
|---|---|---|---|---|
| TC-01 | Login with valid role | User exists and is active | Submit valid credentials | User lands on the correct role-based dashboard. |
| TC-02 | Login rejection for inactive account | User status is Inactive | Submit valid credentials | System blocks access and shows an error. |
| TC-03 | Department creation | Admin is authenticated | Create department with head user | Department is saved and linked to the selected head. |
| TC-04 | Course with modules and lessons | Admin/instructor has course access | Create course, add module, add lesson | Course hierarchy is saved and visible in detail view. |
| TC-05 | Enrollment progress update | Employee is enrolled in a course | Complete a learning milestone or quiz | Enrollment progress increases and status updates. |
| TC-06 | Manual module unlock | Employee and module exist | Unlock module for user | Pivot record stores unlock flag and unlock timestamps. |
| TC-07 | Quiz pass and certificate generation | Quiz is linked to a course | Submit passing quiz attempt | Attempt is recorded and certificate is created. |
| TC-08 | Q&A reply thread | Question exists | Add reply and reaction | Reply thread appears in order and reaction is saved. |
| TC-09 | Notification broadcast | Notification event is triggered | Create notification | Unread count updates and notification is stored. |
| TC-10 | Time log punch in/out | Authenticated user session exists | Punch in, then punch out | Time log and audit links are written correctly. |
| TC-11 | Custom module sync | Custom module and target course exist | Publish and sync the module | Matching course module and lessons are created or updated. |
| TC-12 | Custom UI component visibility | Admin publishes UI component module | Open admin sidebar | UI component appears only for admin users. |
| TC-13 | OTP password reset | User has registered email | Request reset OTP and verify it | OTP is sent, verified, and password can be reset. |
| TC-14 | Recovery-key password reset | User has stored recovery key | Reset password with recovery key | Access is restored without email OTP. |

## 9. Proposed Delivery Gantt Chart

![Diagram 03](../images/diagram-03.png)

## 10. System Architecture Diagram

![Diagram 02](../images/diagram-02.png)

## 11. Schema Distribution Graph

![Diagram 04](../images/diagram-04.png)

## 12. Notes and Assumptions

- The ERD focuses on business tables and omits Laravel infrastructure tables such as cache, jobs, sessions, and password reset tokens from the diagram body.
- Some relationship names in the models use both legacy and current column naming conventions, especially in users and content sync fields.
- The Gantt chart is a proposed delivery plan for documentation and stabilization work, not a historical project log.
- The data dictionary summarizes the major fields used by the application and intentionally groups smaller pivot tables with their parent domain.

## 13. Related Files

- [System documentation](SYSTEM_DOCUMENTATION.md)
- [Content sync design](../CONTENT_SYNC_SYSTEM.md)
- [Custom UI components guide](../CUSTOM_UI_COMPONENTS.md)
- [Codebase exploration report](../CODEBASE_EXPLORATION_REPORT.md)


