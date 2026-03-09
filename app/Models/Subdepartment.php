<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subdepartment extends Model
{
    protected $fillable = [
        'department_id',
        'name',
        'description',
        'head_id',
        'employee_id'
    ];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    /**
     * The head user of this subdepartment.
     */
    public function headUser()
    {
        return $this->belongsTo(User::class, 'head_id');
    }

    /**
     * The employee assigned to this subdepartment.
     */
    public function employee()
    {
        return $this->belongsTo(User::class, 'employee_id');
    }
}
