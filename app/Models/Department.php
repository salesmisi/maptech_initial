<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    protected $fillable = [
        'name',
        'code',
        'head',
        'head_id',
        'status',
        'description',
        'employee_count',
        'course_count'
    ];

    public function subdepartments()
    {
        return $this->hasMany(Subdepartment::class);
    }

    public function headUser()
    {
        return $this->belongsTo(\App\Models\User::class, 'head_id');
    }
}
