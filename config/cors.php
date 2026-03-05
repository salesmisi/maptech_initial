<?php

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'login', 'logout', 'user'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:8000',
        'http://127.0.0.1:8000',
    ],

    'allowed_headers' => ['*'],

    'supports_credentials' => true,

];
