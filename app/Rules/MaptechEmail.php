<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Validates that an email address has the @maptech.com domain.
 * The check is case-insensitive.
 */
class MaptechEmail implements ValidationRule
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

        // Check if email ends with @maptech.com (case-insensitive)
        if (!preg_match('/@maptech\.com$/i', $value)) {
            $fail('The :attribute must be a valid @maptech.com email address.');
        }
    }
}
