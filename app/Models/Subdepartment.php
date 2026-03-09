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
        'instructor_id'
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
     * The instructor assigned to this subdepartment.
     */
    public function instructor()
    {
        return $this->belongsTo(User::class, 'instructor_id');
    }
}
