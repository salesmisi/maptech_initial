# Content Sync System - Learning Management Platform

## Overview

This document describes the complete system logic for syncing learning content from Admin to Instructors and Employees in real-time.

---

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONTENT SYNC FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌─────────────────┐     ┌──────────────────┐
│  ADMIN   │────▶│ Custom Module   │────▶│   Course(s)      │
│          │     │ Builder UI      │     │   Selection      │
└──────────┘     └─────────────────┘     └────────┬─────────┘
                                                   │
                 ┌─────────────────────────────────▼─────────────────────────────────┐
                 │                    SYNC ENGINE                                     │
                 │  ┌─────────────────────────────────────────────────────────────┐  │
                 │  │ ContentSyncService                                           │  │
                 │  │ ├── syncToMultipleCourses()                                  │  │
                 │  │ ├── syncToCourseWithNotifications()                          │  │
                 │  │ ├── autoSyncToLinkedCourses()                                │  │
                 │  │ └── notifyAffectedUsers()                                    │  │
                 │  └─────────────────────────────────────────────────────────────┘  │
                 └───────────────────────────────┬───────────────────────────────────┘
                                                 │
              ┌──────────────────────────────────┼──────────────────────────────────┐
              │                                  │                                  │
              ▼                                  ▼                                  ▼
┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐
│   DATABASE SYNC     │         │   REAL-TIME EVENT   │         │   NOTIFICATIONS     │
│                     │         │                     │         │                     │
│ • Module created    │         │ ContentSynced       │         │ • Instructor alert  │
│ • Lessons synced    │         │ event broadcasts    │         │ • Employee alerts   │
│ • Data consistent   │         │ to course channel   │         │ • In-app + push     │
└─────────────────────┘         └──────────┬──────────┘         └─────────────────────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│    INSTRUCTOR       │   │    INSTRUCTOR       │   │     EMPLOYEE        │
│    Dashboard        │   │    Course View      │   │     Dashboard       │
│                     │   │                     │   │                     │
│ • Sees new module   │   │ • Module visible    │   │ • Notification      │
│ • No action needed  │   │ • Auto-appears      │   │ • Module accessible │
│ • Read-only access  │   │ • Lessons ready     │   │ • Can start learning│
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
```

---

## Step-by-Step Logic

### Phase 1: Admin Creates Content

```
ADMIN ACTION:
1. Navigate to Custom Field Builder (/admin/custom-modules)
2. Click "New Module"
3. Fill in module details:
   - Title (required)
   - Description
   - Category
   - Tags (for filtering)
   - Thumbnail
   - Status: Draft/Published
4. Save module
5. Add lessons to module:
   - Text content (rich text editor)
   - Video (upload or URL)
   - File (PDF, documents)
   - Links (external resources)
   - Quiz (linked quiz)
6. Set module status to "Published"

SYSTEM ACTION:
- CustomModule record created in database
- CustomLesson records created for each lesson
- Module version tracked in custom_module_versions
```

### Phase 2: Course Mapping

```
ADMIN ACTION:
1. Click "Push to Course" on the module
2. Select one or more target courses
3. Click "Sync to Courses"

SYSTEM ACTION:
- API call: POST /api/admin/custom-modules/{id}/push-to-courses
- Request body: { course_ids: ["uuid1", "uuid2", "uuid3"] }
- ContentSyncService.syncToMultipleCourses() called
```

### Phase 3: Sync Engine Processing

```pseudocode
function syncToMultipleCourses(customModule, courseIds, admin):
    results = { success: 0, failed: 0, errors: [] }
    
    FOR EACH courseId IN courseIds:
        course = Course.find(courseId)
        IF course NOT EXISTS:
            results.errors.push("Course not found")
            results.failed++
            CONTINUE
        
        TRY:
            module = syncToCourseWithNotifications(customModule, course, admin)
            results.success++
        CATCH error:
            log.error("Sync failed", error)
            results.errors.push(error.message)
            results.failed++
    
    RETURN results


function syncToCourseWithNotifications(customModule, course, admin):
    isNewSync = NOT course.modules.where(custom_module_id = customModule.id).exists()
    
    // Database transaction for data consistency
    BEGIN TRANSACTION:
        IF isNewSync:
            // Create new module in course
            module = course.modules.create({
                custom_module_id: customModule.id,
                title: customModule.title,
                description: customModule.description,
                logo_path: customModule.thumbnail_path,
                order: course.modules.max('order') + 1
            })
            
            // Create all lessons
            FOR EACH customLesson IN customModule.lessons:
                module.lessons.create({
                    custom_lesson_id: customLesson.id,
                    title: customLesson.title,
                    type: mapContentType(customLesson.content_type),
                    text_content: customLesson.text_content,
                    content_path: customLesson.content_path,
                    status: customLesson.status == 'published' ? 'Active' : 'Draft',
                    order: customLesson.order
                })
        ELSE:
            // Update existing module
            module = course.modules.where(custom_module_id = customModule.id).first()
            module.update({
                title: customModule.title,
                description: customModule.description,
                logo_path: customModule.thumbnail_path
            })
            
            // Sync lessons (create/update/delete)
            syncLessons(customModule, module)
    COMMIT TRANSACTION
    
    // Fire real-time event
    event(ContentSynced(course, module, customModule, isNewSync ? 'created' : 'updated'))
    
    // Send notifications
    notifyAffectedUsers(customModule, course, module, isNewSync)
    
    RETURN module
```

### Phase 4: Real-Time Broadcasting

```pseudocode
EVENT ContentSynced:
    // Broadcasts to: private-course.{courseId}
    // All enrolled users and instructors receive this event
    
    data = {
        action: 'created' | 'updated',
        course_id: course.id,
        course_title: course.title,
        module_id: module.id,
        module_title: module.title,
        lessons_count: module.lessons.count(),
        synced_at: now()
    }
    
    // Frontend listener updates UI without refresh
    // Employee dashboard shows new module
    // Instructor course view shows new module
```

### Phase 5: Notification Distribution

```pseudocode
function notifyAffectedUsers(customModule, course, module, isNew):
    type = isNew ? 'new_content' : 'content_updated'
    title = isNew ? 'New Learning Content Available' : 'Learning Content Updated'
    message = isNew 
        ? "A new module '{customModule.title}' has been added to '{course.title}'."
        : "The module '{customModule.title}' in '{course.title}' has been updated."
    
    // 1. Notify Course Instructor
    IF course.instructor_id:
        createNotification(
            user_id: course.instructor_id,
            course_id: course.id,
            module_id: module.id,
            type: type,
            title: title,
            message: message
        )
    
    // 2. Notify All Enrolled Employees
    enrolledUsers = Enrollment
        .where(course_id = course.id)
        .where(status != 'Dropped')
        .pluck('user_id')
    
    FOR EACH userId IN enrolledUsers:
        createNotification(
            user_id: userId,
            course_id: course.id,
            module_id: module.id,
            type: type,
            title: title,
            message: message
        )
    
    // Notifications auto-broadcast via model event
    // NotificationCreated event fires for each notification
    // User's notification bell updates in real-time
```

### Phase 6: Auto-Sync on Module Update

```pseudocode
// When Admin edits a published CustomModule:

MODEL CustomModule:
    BOOT:
        ON updated:
            IF status == 'published':
                event(CustomModuleUpdated(this))

LISTENER SyncCustomModuleToCourses:
    handle(CustomModuleUpdated event):
        IF NOT event.shouldSync:
            RETURN
        
        // Find all courses with this module linked
        linkedModules = Module.where(custom_module_id = event.customModule.id)
        
        FOR EACH module IN linkedModules:
            course = module.course
            
            // Update module content
            module.update({
                title: event.customModule.title,
                description: event.customModule.description
            })
            
            // Sync lessons
            syncLessons(event.customModule, module)
            
            // Broadcast update
            event(ContentSynced(course, module, event.customModule, 'updated'))
            
            // Notify users
            notifyAffectedUsers(event.customModule, course, module, false)
```

---

## Access Control Matrix

| Role       | Custom Modules | Course Modules | Lessons | Sync Action |
|------------|----------------|----------------|---------|-------------|
| Admin      | Create, Edit, Delete, Publish | View (inherited) | Create, Edit (via Custom) | Push to Courses |
| Instructor | View Published | View, Reorder* | View | None |
| Employee   | None | View (if enrolled) | View, Complete | None |

*Instructors can reorder modules within their courses but cannot edit synced content.

---

## Data Consistency Guarantees

1. **Transaction Safety**: All sync operations wrapped in DB transactions
2. **Orphan Prevention**: Lessons without parent modules are auto-deleted
3. **Version Tracking**: CustomModuleVersion records all changes
4. **Audit Trail**: AuditLog captures admin actions

---

## Real-Time Update Channels

| Channel | Subscribers | Events |
|---------|-------------|--------|
| `private-course.{courseId}` | Instructor, Enrolled Employees | ContentSynced |
| `private-notifications.{userId}` | Individual User | NotificationCreated, NotificationCountUpdated |

---

## API Endpoints

### Admin Endpoints
```
POST   /api/admin/custom-modules                    # Create module
PUT    /api/admin/custom-modules/{id}               # Update module
DELETE /api/admin/custom-modules/{id}               # Delete module
POST   /api/admin/custom-modules/{id}/push-to-courses  # Sync to multiple courses
GET    /api/admin/custom-modules/{id}/available-courses # List available courses
```

### Instructor Endpoints (Read-Only)
```
GET    /api/instructor/custom-modules               # List published modules
GET    /api/instructor/custom-modules/{id}          # View module details
```

### Employee Endpoints (Read-Only)
```
GET    /api/employee/custom-modules                 # List accessible modules
GET    /api/employee/custom-modules/{id}            # View module details
```

---

## Files Involved

```
app/
├── Events/
│   ├── ContentSynced.php          # Real-time broadcast event
│   └── CustomModuleUpdated.php    # Trigger for auto-sync
├── Listeners/
│   └── SyncCustomModuleToCourses.php  # Event handler
├── Services/
│   ├── ContentSyncService.php     # Main sync orchestrator
│   └── CustomModuleSyncService.php # Low-level sync operations
├── Models/
│   ├── CustomModule.php           # Admin-created modules
│   ├── CustomLesson.php           # Lessons in custom modules
│   ├── Module.php                 # Course modules (synced)
│   ├── Lesson.php                 # Course lessons (synced)
│   └── Notification.php           # User notifications
├── Http/Controllers/Admin/
│   ├── CustomModuleController.php # Admin CRUD + sync
│   └── CustomLessonController.php # Lesson management
└── Providers/
    ├── BroadcastServiceProvider.php  # Channel authorization
    └── EventServiceProvider.php      # Event-listener mapping
```

---

## Frontend Integration

```typescript
// Listen for content sync events on course channel
Echo.private(`course.${courseId}`)
  .listen('.content.synced', (event) => {
    console.log('New content synced:', event);
    // Refresh module list
    fetchModules();
    // Show toast notification
    showToast(`New module added: ${event.module_title}`);
  });

// Listen for notifications
Echo.private(`notifications.${userId}`)
  .listen('.notification.created', (event) => {
    // Update notification badge
    incrementNotificationCount();
    // Show notification popup
    showNotification(event.notification);
  });
```
