# Codebase Exploration Report: Course Data Fetching & API Endpoints

## Summary

This report documents all course-related API endpoints, the React components that consume them, and their current eager-load configurations.

---

## 1. Course Detail/Manage-Content Pages

### Admin Course Detail/Management
- **Component**: [resources/js/src/pages/admin/CourseDetail.tsx](resources/js/src/pages/admin/CourseDetail.tsx)
- **API Endpoint**: `GET /api/admin/courses/{courseId}`
- **Controller**: `App\Http\Controllers\Admin\CourseController::show()`
- **Purpose**: View and manage a single course (modules, lessons, enrollments)

### Instructor Course Detail/Management  
- **Component**: [resources/js/src/pages/instructor/CourseDetail.tsx](resources/js/src/pages/instructor/CourseDetail.tsx)
- **API Endpoint**: `GET /api/instructor/courses/{courseId}`
- **Controller**: `App\Http\Controllers\Instructor\CourseController::show()`
- **Purpose**: Instructor view/manage their assigned courses

### Employee Course Detail
- **Component**: [resources/js/src/pages/employee/CourseEnrollDetail.tsx](resources/js/src/pages/employee/CourseEnrollDetail.tsx)
- **API Endpoint**: `GET /api/employee/courses/{courseId}`
- **Controller**: `App\Http\Controllers\Employee\DashboardController::showCourse()`
- **Purpose**: Employee view enrolled course details and content

---

## 2. Eager-Load Relations by Endpoint

### Admin: `/api/admin/courses/{id}`
**File**: [app/Http/Controllers/Admin/CourseController.php](app/Http/Controllers/Admin/CourseController.php) (line 223)

```php
Course::with([
    'instructor:id,fullname,email,profile_picture',
    'modules.lessons',
    'enrolledUsers:id,fullname,email,department,role,status',
])->findOrFail($id);
```

**Relations loaded:**
- ✅ `instructor` - selected columns: id, fullname, email, profile_picture
- ✅ `modules` with nested `lessons` - all columns
- ✅ `enrolledUsers` - selected columns: id, fullname, email, department, role, status

**Note**: After loading, recalculates progress for each enrolled user and reloads `enrolledUsers` to get updated pivot data.

---

### Instructor: `/api/instructor/courses/{id}`
**File**: [app/Http/Controllers/Instructor/CourseController.php](app/Http/Controllers/Instructor/CourseController.php) (line 224)

```php
Course::with(['modules.lessons', 'enrolledUsers:id,fullname,email,department,role,status'])
    ->find($id);
```

**Relations loaded:**
- ✅ `modules` with nested `lessons` - all columns
- ✅ `enrolledUsers` - selected columns: id, fullname, email, department, role, status
- ❌ `instructor` - NOT loaded

**Note**: Also recalculates progress and reloads enrolledUsers for updated pivot data. Includes authorization checks.

---

### Employee: `/api/employee/courses/{id}`
**File**: [app/Http/Controllers/Employee/DashboardController.php](app/Http/Controllers/Employee/DashboardController.php) (line 329)

```php
Course::active()
    ->with([
        'instructor:id,fullname,email',
        'modules' => fn($q) => $q->with('lessons')->orderBy('order')->orderBy('id'),
    ])
    ->find($id);
```

**Relations loaded:**
- ✅ `instructor` - selected columns: id, fullname, email
- ✅ `modules` with nested `lessons` - ordered by order, id
- ✅ Active courses only (`->active()` scope)

**Note**: Does NOT load enrolledUsers. Includes lock/unlock validation and manual module unlock checks.

---

## 3. All API Routes Fetching Course Data

### Course List Endpoints

| Method | Endpoint | Controller | Eager-Load |
|--------|----------|-----------|-----------|
| GET | `/api/admin/courses` | AdminCourseController::index() | `['instructor:id,fullname,email,profile_picture', 'modules']` + enrollments count |
| GET | `/api/instructor/courses` | InstructorCourseController::index() | (Not found in provided code) |
| GET | `/api/employee/all-courses` | DashboardController::allCourses() | (Not found in provided code) |
| GET | `/api/employee/courses` | DashboardController::courses() | (enrolled courses, not in provided code) |

### Course Show Endpoints

| Method | Endpoint | Controller | Eager-Load |
|--------|----------|-----------|-----------|
| GET | `/api/admin/courses/{id}` | AdminCourseController::show() | `['instructor:...', 'modules.lessons', 'enrolledUsers:...']` |
| GET | `/api/instructor/courses/{id}` | InstructorCourseController::show() | `['modules.lessons', 'enrolledUsers:...']` |
| GET | `/api/employee/courses/{id}` | DashboardController::showCourse() | `['instructor:...', 'modules.lessons']` |

### Module Endpoints

| Method | Endpoint | Controller | Eager-Load |
|--------|----------|-----------|-----------|
| GET | `/api/courses/{courseId}/modules` | ContentController::modulesByCourse() | (Not specified in search) |
| GET | `/api/admin/modules/{moduleId}/enrollment-lists` | AdminCourseController::moduleEnrollmentLists() | (Enrollment pivot data) |

### Enrollment Endpoints

| Method | Endpoint | Controller | Eager-Load |
|--------|----------|-----------|-----------|
| GET | `/api/admin/enrollments` | AdminCourseController::allEnrollments() | (Not specified in search) |
| GET | `/api/admin/courses/{id}/enrollments` | AdminCourseController::enrollments() | (Enrolled users) |
| GET | `/api/admin/courses/{id}/students` | AdminCourseController::students() | (Enrolled students list) |
| GET | `/api/instructor/courses/{id}/enrollments` | InstructorCourseController::enrollments() | (Enrolled users) |

---

## 4. All Pages Fetching Course/Department/User Data

### Admin Pages

| Page | Component | Endpoints Called | Eager-Load Status |
|------|-----------|------------------|-------------------|
| **Course Management (List)** | CoursesAndContent.tsx | `/api/admin/courses` | Loads: instructor, modules; **Missing**: enrolledUsers details |
| **Course Detail/Manage** | CourseDetail.tsx | `/api/admin/courses/{id}` | ✅ Full: instructor, modules.lessons, enrolledUsers |
| **Enrollment Management** | EnrollmentManagement.tsx | `/api/admin/enrollments`, `/api/admin/courses`, `/api/admin/modules/{id}/enrollment-lists` | ✅ Good |
| **Department Management** | DepartmentManagement.tsx | `/api/departments` | Loads: subdepartments with users |
| **User Management** | UserManagement.tsx | `/api/admin/users` | (Not fully specified) |
| **Admin Dashboard** | AdminDashboard.tsx | `/api/admin/dashboard`, `/api/admin/activity` | (Not specified) |

### Instructor Pages

| Page | Component | Endpoints Called | Eager-Load Status |
|------|-----------|------------------|-------------------|
| **Course Management (List)** | CourseManagement.tsx | `/api/instructor/courses` | (Not fully specified) |
| **Course Detail/Manage** | CourseDetail.tsx | `/api/instructor/courses/{id}` | ✅ Full: modules.lessons, enrolledUsers; **Missing**: instructor |
| **Instructor Dashboard** | (Dashboard component) | `/api/instructor/dashboard` | (Not specified) |

### Employee Pages

| Page | Component | Endpoints Called | Eager-Load Status |
|------|-----------|------------------|-------------------|
| **Dashboard** | EmployeeDashboard.tsx | `/api/employee/dashboard` | (Not specified) |
| **My Courses (List)** | MyCourses.tsx | `/api/employee/courses`, `/api/departments` | ⚠️ Basic enrollment info only |
| **Course Enrollment** | CourseEnrollDetail.tsx | `/api/employee/courses/{id}` | ✅ Good: instructor, modules.lessons |
| **Course Viewer** | CourseViewer.tsx | `/api/employee/courses/{id}` (study mode) | ⚠️ Limited data loading |
| **Progress** | MyProgress.tsx | `/api/employee/progress` | (Not specified) |
| **Certificates** | MyCertificates.tsx | `/api/employee/certificates` | (Not specified) |

---

## 5. "Course not found" Error Messages

### Where Triggered

1. **Frontend (React)**
   - [instructor/CourseDetail.tsx#407](resources/js/src/pages/instructor/CourseDetail.tsx#L407): `throw new Error('Course not found.');`
   - [employee/CourseEnrollDetail.tsx#64](resources/js/src/pages/employee/CourseEnrollDetail.tsx#L64): `throw new Error('Course not found.');`
   - [admin/CourseDetail.tsx#704](resources/js/src/pages/admin/CourseDetail.tsx#L704): `{error || 'Course not found'}`

2. **Backend (Laravel)**
   - [Admin/CourseController.php#234](app/Http/Controllers/Admin/CourseController.php#L234): `return response()->json(['message' => 'Course not found.'], 404);`
   - [Instructor/CourseController.php#234](app/Http/Controllers/Instructor/CourseController.php#L234): Not loaded in provided code
   - [Employee/DashboardController.php#290](app/Http/Controllers/Employee/DashboardController.php#L290): `return response()->json(['message' => 'Course not found or not available.'], 404);`
   - [Employee/DashboardController.php#344](app/Http/Controllers/Employee/DashboardController.php#L344): `return response()->json(['message' => 'Course not found or not accessible.'], 404);`

---

## 6. Missing Eager-Load Relations Analysis

### Admin Course Detail (`/api/admin/courses/{id}`)
**Current**: ✅ Complete - loads instructor, modules.lessons, enrolledUsers

**Potential Improvements:**
- Could load `course.quizzes` for quiz management UI
- Could pre-count questions per quiz for quiz summary

### Instructor Course Detail (`/api/instructor/courses/{id}`)  
**Current**: ⚠️ MISSING `instructor` relation
- **Issue**: Component shows instructor info but API doesn't load it
- **Solution**: Add `'instructor:id,fullname,email,profile_picture'` to with() clause
- **Location**: [app/Http/Controllers/Instructor/CourseController.php#256](app/Http/Controllers/Instructor/CourseController.php#L256)

### Employee Course Detail (`/api/employee/courses/{id}`)
**Current**: ✅ Good basic load but MISSING enrolledUsers
- **Issue**: Employee needs to see their own enrollment/progress record
- **Missing**: Enrollment pivot data (progress, status, locked, unlocked_until)
- **Could add**: `'enrollments' => fn($q) => $q->where('user_id', auth()->id())` 

### Instructor Course List (`/api/instructor/courses`)
**Current**: Unknown - not found in provided code search
- **Expected**: Similar to admin list with: `['instructor', 'modules']` + enrollments count

### Employee Course List (`/api/employee/courses`)
**Current**: Unknown - not found in provided code search  
- **Expected**: Simpler load with just modules count and enrollment status

---

## 7. Department & User Endpoints (Related Data)

### Department Endpoints

| Method | Endpoint | Eager-Load |
|--------|----------|-----------|
| GET | `/api/departments` | `['subdepartments.headUser', 'subdepartments.employee', 'subdepartments.employees', 'headUser']` |
| POST | `/api/departments` | Creates with specified relations |
| PUT | `/api/departments/{id}` | Updates |
| DELETE | `/api/departments/{id}` | Deletes |

### User Endpoints

| Method | Endpoint | Eager-Load |
|--------|----------|-----------|
| GET | `/api/admin/users` | (Not fully specified) |
| GET | `/api/admin/users/{id}` | (Not fully specified) |
| GET | `/api/instructor/users` | (For enrollment dropdown) |
| GET | `/api/employee/{id}` | (User profile) |

---

## 8. Performance Recommendations

### High Priority
1. **Instructor Controller**: Add missing `instructor` relation to `/api/instructor/courses/{id}`
2. **Employee Controller**: Consider adding `enrollments.user` relation to `/api/employee/courses/{id}`

### Medium Priority  
1. Add pre-counted `quizzes` relation to course endpoints where UI shows quiz counts
2. Load `modules.quizzes` with question counts instead of querying separately
3. Implement module-level lock status in eager load (currently queried separately in employee endpoint)

### Query Analysis
- **Admin Detail View**: Makes 3 queries (load course, recalculate progress for each user, reload enrolledUsers)
- **Employee Detail View**: Makes multiple queries for lock/unlock status checks
- **Consider**: Returning lock status in enrollments pivot for employee endpoint

---

## 9. Related Documentation

See also:
- Product Logo Manager - one active logo per course: `/api/admin/product-logos/courses/{course}/logo`
- Custom Modules - can be pushed to courses: `/api/admin/custom-modules/{id}/push-to-course`
- Quiz Management - per course: `/api/admin/courses/{courseId}/quizzes`

---

## File References

**Controllers:**
- [app/Http/Controllers/Admin/CourseController.php](app/Http/Controllers/Admin/CourseController.php)
- [app/Http/Controllers/Instructor/CourseController.php](app/Http/Controllers/Instructor/CourseController.php)
- [app/Http/Controllers/Employee/DashboardController.php](app/Http/Controllers/Employee/DashboardController.php)

**Routes:**
- [routes/api.php](routes/api.php) - All endpoint definitions

**React Components:**
- Admin: [resources/js/src/pages/admin/CourseDetail.tsx](resources/js/src/pages/admin/CourseDetail.tsx)
- Instructor: [resources/js/src/pages/instructor/CourseDetail.tsx](resources/js/src/pages/instructor/CourseDetail.tsx)  
- Employee: [resources/js/src/pages/employee/CourseEnrollDetail.tsx](resources/js/src/pages/employee/CourseEnrollDetail.tsx)
- Lists: [resources/js/src/pages/admin/CoursesAndContent.tsx](resources/js/src/pages/admin/CoursesAndContent.tsx)

---

**Report Generated**: April 8, 2026
**Codebase Version**: Laravel + React (TypeScript frontend)
