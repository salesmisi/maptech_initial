# Custom UI Components - Dynamic Sidebar Modules

## Overview

The Custom Field Builder now supports creating two types of modules:

1. **Learning Modules** - Traditional course modules with lessons (existing functionality)
2. **UI Component Modules** - Custom navigation items that appear in the admin sidebar

## ⚠️ Access Restrictions

**IMPORTANT**: UI Components are **Admin-Only** features:

- ✅ **Admin Users**: Can create, edit, publish, and view UI Component modules
- ❌ **Instructor Users**: Cannot access UI Components (only see Learning Modules)
- ❌ **Employee Users**: Cannot access UI Components (only see assigned Learning Modules)

### Why UI Components are Admin-Only:

1. **Dashboard Customization**: UI Components allow customization of the sidebar navigation and admin dashboard
2. **System Configuration**: These components are intended for system-wide administrative tools and pages
3. **Security**: Restricting access prevents unauthorized modification of navigation and administrative interfaces

### Module Type Behavior:

| Feature | Learning Modules | UI Components |
|---------|-----------------|---------------|
| Create/Edit | Admin only | Admin only |
| View in Admin Dashboard | Yes | Yes |
| View in Instructor Dashboard | Yes (when published) | **No** (filtered out) |
| View in Employee Dashboard | Yes (when assigned) | **No** (filtered out) |
| Appears in Sidebar | No | Yes (admin only) |
| Can be assigned to users | Yes | No |

## Creating a UI Component Module

### Step 1: Navigate to Custom Field Builder

1. Log in as an Admin
2. Navigate to **Custom Field Builder** from the sidebar

### Step 2: Create New Module

1. Click **"New Module"** button
2. Fill in the required fields:

#### Required Fields:
- **Title** - The display name in the sidebar (e.g., "Task Dashboard")
- **Module Type** - Select "UI Component (sidebar navigation)"
- **Route Path** - URL identifier without spaces or special characters (e.g., "custom-task-dashboard")
- **Icon Name** - A Lucide icon name (e.g., "Clipboard", "Calendar", "FileText", "Briefcase")

#### Optional Fields:
- **Description** - Brief description of the module's purpose
- **Status** - Set to "Published" to make it visible in the sidebar

### Step 3: Publish the Module

1. Set the **Status** to **"Published"**
2. Click **"Create"** or **"Update"**
3. The custom module will now appear in the admin sidebar

## Available Icons

You can use any of these Lucide icon names:

- **General**: Clipboard, Calendar, FileText, Briefcase, FolderOpen, Home
- **Tasks**: CheckSquare, Target, Activity, Clock
- **Data**: Database, PieChart, BarChart2, TrendingUp
- **Info**: Info, HelpCircle, AlertCircle, Star
- **Files**: File, Folder, Upload, Download
- **Actions**: Grid, List, Layout, Layers, Filter, Tag
- **Commerce**: ShoppingCart, DollarSign, Package

For the complete list, see the icon mapping in `AdminLayout.tsx`.

## Module Positioning

Custom UI component modules are inserted in the sidebar after:
- Dashboard
- Departments
- User Management
- Courses and Content
- Custom Field Builder

And before:
- Q&A
- Enrollments
- Reports & Analytics
- (other standard menu items)

## Example: Creating a "Task Dashboard" Module

1. **Title**: Task Dashboard
2. **Module Type**: UI Component (sidebar navigation)
3. **Route Path**: custom-task-dashboard
4. **Icon Name**: Clipboard
5. **Description**: View and manage all tasks
6. **Status**: Published

Once created, clicking "Task Dashboard" in the sidebar will navigate to a dedicated page at the route `custom-task-dashboard`.

## Customizing the UI Component Page

By default, UI component modules display a placeholder page. To customize:

1. Edit `resources/js/src/pages/admin/CustomModulePage.tsx`
2. Add conditional rendering based on `routePath` or `component_config`
3. Example:

```tsx
if (module.route_path === 'custom-task-dashboard') {
  return <TaskDashboardComponent />;
}

if (module.route_path === 'custom-reports') {
  return <CustomReportsComponent />;
}
```

## Component Configuration

You can store additional configuration in the `component_config` JSON field:

```json
{
  "widgetType": "dashboard",
  "refreshInterval": 30,
  "displayOptions": ["tasks", "deadlines", "assignments"]
}
```

Access this configuration in your custom component via `module.component_config`.

## Managing UI Components

- **Edit**: Click the edit button on any module in Custom Field Builder
- **Unpublish**: Change status to "Unpublished" to hide from sidebar
- **Delete**: Permanently remove the module
- **Reorder**: Drag and drop to change the order in the sidebar (coming soon)

## Technical Details

### Database Schema

New fields added to `custom_modules` table:
- `module_type` - enum('learning', 'ui_component')
- `route_path` - string, unique identifier for routing
- `icon_name` - string, Lucide icon name
- `component_config` - JSON, additional configuration data

### API Endpoints

- `GET /api/admin/custom-modules/ui-components` - Fetch published UI components

### Files Modified

- `database/migrations/2026_04_01_120000_add_ui_component_fields_to_custom_modules.php`
- `app/Models/CustomModule.php`
- `app/Http/Controllers/Admin/CustomModuleController.php`
- `resources/js/src/pages/admin/CustomFieldBuilder.tsx`
- `resources/js/src/pages/admin/CustomModulePage.tsx`
- `resources/js/src/components/layout/AdminLayout.tsx`
- `resources/js/src/App.tsx`
- `routes/api.php`

## Notes

- UI Component modules cannot have lessons (that's for Learning Modules only)
- Module type cannot be changed after creation
- Only published modules appear in the sidebar
- The sidebar automatically refreshes when modules are published/unpublished
- Custom modules appear for Admin role only (can be extended to other roles if needed)
