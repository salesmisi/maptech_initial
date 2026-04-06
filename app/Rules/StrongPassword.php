<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Validates password strength with the following rules:
 * - Minimum of 8 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 special character (!@#$%^&*)
 * - Must contain 2 to 3 numeric digits (0-9 only)
 */
class StrongPassword implements ValidationRule
{
    /**
     * Run the validation rule.
     *
     * @param  \Closure(string, ?string=): \Illuminate\Translation\PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        // Ensure value is a string
        if (!is_string($value)) {
            $fail('The :attribute must be a string.');
            return;
        }

        // Check minimum length of 8 characters
        if (strlen($value) < 8) {
            $fail('The :attribute must be at least 8 characters.');
            return;
        }

        // Check for at least 1 uppercase letter (A-Z)
        if (!preg_match('/[A-Z]/', $value)) {
            $fail('The :attribute must contain at least 1 uppercase letter (A-Z).');
            return;
        }

        // Check for at least 1 special character
        if (!preg_match('/[!@#$%^&*]/', $value)) {
            $fail('The :attribute must contain at least 1 special character (!@#$%^&*).');
            return;
        }

        // Count numeric digits
        $digitCount = preg_match_all('/[0-9]/', $value);

        // Must contain exactly 2 to 3 numeric digits
        if ($digitCount < 2) {
            $fail('The :attribute must contain at least 2 numeric digits.');
            return;
        }

        if ($digitCount > 3) {
            $fail('The :attribute must contain no more than 3 numeric digits.');
            return;
        }
    }
}
