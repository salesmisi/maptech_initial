<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BusinessDetail extends Model
{
    protected $fillable = [
        'company_name',
        'logo_path',
    ];
}
