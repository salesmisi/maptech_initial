<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $company_name
 * @property string $logo_path
 * @property string|null $email
 * @property string|null $phone
 * @property string|null $mobile_phone
 * @property string|null $country
 * @property string|null $address
 * @property string|null $website
 * @property string|null $vat_reg_tin
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class BusinessDetail extends Model
{
    protected $fillable = [
        'company_name',
        'logo_path',
        'email',
        'phone',
        'mobile_phone',
        'country',
        'address',
        'website',
        'vat_reg_tin',
    ];
}
