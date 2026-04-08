<?php

namespace App\Policies;

use App\Models\CustomModule;
use App\Models\User;

class CustomModulePolicy
{
    /**
     * Determine whether the user can view any models.
     * All authenticated users can view the list of custom modules.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can view the model.
     * All authenticated users can view published modules.
     * Admins can view all modules including drafts.
     */
    public function view(User $user, CustomModule $customModule): bool
    {
        // Admins can view all modules
        if (strtolower($user->role) === 'admin') {
            return true;
        }

        // Instructors and Employees can only view published modules
        return $customModule->status === 'published';
    }

    /**
     * Determine whether the user can create models.
     * Only Admins can create custom modules.
     */
    public function create(User $user): bool
    {
        return strtolower($user->role) === 'admin';
    }

    /**
     * Determine whether the user can update the model.
     * Only Admins can update custom modules.
     */
    public function update(User $user, CustomModule $customModule): bool
    {
        return strtolower($user->role) === 'admin';
    }

    /**
     * Determine whether the user can delete the model.
     * Only Admins can delete custom modules.
     */
    public function delete(User $user, CustomModule $customModule): bool
    {
        return strtolower($user->role) === 'admin';
    }

    /**
     * Determine whether the user can restore the model.
     * Only Admins can restore custom modules.
     */
    public function restore(User $user, CustomModule $customModule): bool
    {
        return strtolower($user->role) === 'admin';
    }

    /**
     * Determine whether the user can permanently delete the model.
     * Only Admins can force delete custom modules.
     */
    public function forceDelete(User $user, CustomModule $customModule): bool
    {
        return strtolower($user->role) === 'admin';
    }

    /**
     * Determine whether the user can publish/unpublish the model.
     * Only Admins can toggle publish status.
     */
    public function togglePublish(User $user, CustomModule $customModule): bool
    {
        return strtolower($user->role) === 'admin';
    }

    /**
     * Determine whether the user can push to courses.
     * Only Admins can push modules to courses.
     */
    public function pushToCourse(User $user, CustomModule $customModule): bool
    {
        return strtolower($user->role) === 'admin';
    }
}
