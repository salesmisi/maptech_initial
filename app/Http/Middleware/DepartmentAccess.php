<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DepartmentAccess
{
    /**
     * Handle an incoming request.
     * Verify employee can only access resources from their department.
     *
     * This middleware extracts department from authenticated user
     * and validates access to department-specific resources.
     *
     * @param  string|null  $department  Optional department to validate against
     */
    public function handle(Request $request, Closure $next, ?string $department = null): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'message' => 'Unauthenticated'
            ], 401);
        }

        // Admin and Instructor can access all departments
        if ($user->isAdmin() || $user->isInstructor()) {
            return $next($request);
        }

        // For employees, verify department access
        if ($user->isEmployee()) {
            $userDepartment = $user->department;

            // If no department assigned to employee
            if (!$userDepartment) {
                return response()->json([
                    'message' => 'No department assigned to your account. Please contact administrator.'
                ], 403);
            }

            // If specific department is required and doesn't match
            if ($department && strtolower($userDepartment) !== strtolower($department)) {
                return response()->json([
                    'message' => 'Forbidden. You cannot access resources from another department.',
                    'your_department' => $userDepartment,
                    'required_department' => $department
                ], 403);
            }

            // Check route parameter for department
            $routeDepartment = $request->route('department');
            if ($routeDepartment && strtolower($userDepartment) !== strtolower($routeDepartment)) {
                return response()->json([
                    'message' => 'Forbidden. You cannot access resources from another department.',
                    'your_department' => $userDepartment,
                    'requested_department' => $routeDepartment
                ], 403);
            }

            // Inject user's department into request for controllers
            $request->merge(['user_department' => $userDepartment]);
        }

        return $next($request);
    }
}
