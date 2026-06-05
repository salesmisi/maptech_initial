# Color Palette Standardization

## Standard Color Palette

This document defines the standardized color palette used across the application for consistency.

### Primary Action Colors

#### Green - Create/Add Actions
- **Light Mode**: `bg-green-600 hover:bg-green-700`
- **Dark Mode**: `dark:bg-green-600 dark:hover:bg-green-700`
- **Use Cases**: Add buttons, create actions, submit forms, save operations

#### Blue - View/Navigate Actions
- **Light Mode**: `bg-blue-600 hover:bg-blue-700`
- **Dark Mode**: `dark:bg-blue-600 dark:hover:bg-blue-700`
- **Use Cases**: View details, navigate, info buttons, preview actions

#### Red/Rose - Delete/Destructive Actions
- **Light Mode**: `bg-red-600 hover:bg-red-700` or `bg-rose-600 hover:bg-rose-700`
- **Dark Mode**: `dark:bg-red-600 dark:hover:bg-red-700` or `dark:bg-rose-600 dark:hover:bg-rose-700`
- **Use Cases**: Delete buttons, remove actions, destructive operations

#### Purple - Special/Unique Actions
- **Light Mode**: `bg-purple-600 hover:bg-purple-700`
- **Dark Mode**: `dark:bg-purple-600 dark:hover:bg-purple-700`
- **Use Cases**: Pre-tests, post-tests, special features

### Deprecated Colors

The following colors have been **removed** from the codebase:
- `indigo-500`, `indigo-600`, `indigo-700`
- `emerald-500`, `emerald-600`, `emerald-700`

These were replaced with the standard palette above to maintain consistency.

### Focus Ring Colors

- Green buttons: `focus:ring-green-500 dark:focus:ring-green-400`
- Blue buttons: `focus:ring-blue-500 dark:focus:ring-blue-400`
- Red buttons: `focus:ring-red-500 dark:focus:ring-red-400`
- Purple buttons: `focus:ring-purple-500 dark:focus:ring-purple-400`

### Text Colors

- Primary text: `text-white` (on colored backgrounds)
- Secondary text: `text-slate-700 dark:text-slate-200`
- Muted text: `text-slate-500 dark:text-slate-400`

## Implementation Guidelines

1. **Always include dark mode variants** when using colors
2. **Use consistent shading**: 600 for normal, 700 for hover, 500 for focus rings
3. **Match action to color**: 
   - Creation/Addition → Green
   - Navigation/Viewing → Blue
   - Deletion/Destruction → Red/Rose
   - Special features → Purple
4. **Avoid mixing color shades**: Don't use green-500 with green-700 in the same context

## Benefits

- **User Experience**: Consistent colors help users predict button behavior
- **Accessibility**: High contrast ratios in both light and dark modes
- **Maintainability**: Standardized palette makes updates easier
- **Brand Consistency**: Unified visual language across all interfaces
