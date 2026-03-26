<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Default Broadcaster
    |--------------------------------------------------------------------------
    |
    | This option controls the default broadcaster that will be used by the
    | framework when an event needs to be broadcast. You may set this to
    | any of the connections defined in the "connections" array below.
    |
    */

    // Choose sensible default: prefer the `pusher` connection only when both
    // the app is configured to use it and a non-placeholder key exists.
    // Otherwise fallback to `log` to avoid cURL errors when no websocket
    // server or Pusher credentials are present in development.
    'default' => (
        env('BROADCAST_CONNECTION') === 'pusher'
        && env('PUSHER_APP_KEY')
        && env('PUSHER_APP_KEY') !== 'your-pusher-app-key'
    ) ? 'pusher' : 'log',

    /*
    |--------------------------------------------------------------------------
    | Broadcast Connections
    |--------------------------------------------------------------------------
    |
    | Here are each of the broadcast connections that are used to broadcast
    | events to other systems or over websockets. Examples are provided for
    | the Pusher and log drivers. Add others as needed for your setup.
    |
    */

    'connections' => [
        'pusher' => [
            'driver' => 'pusher',
            'key' => env('PUSHER_APP_KEY'),
            'secret' => env('PUSHER_APP_SECRET'),
            'app_id' => env('PUSHER_APP_ID'),
            'options' => [
                'cluster' => env('PUSHER_APP_CLUSTER'),
                'useTLS' => env('PUSHER_SCHEME', 'https') === 'https',
                'host' => env('PUSHER_HOST', null),
                'port' => env('PUSHER_PORT', null),
                'scheme' => env('PUSHER_SCHEME', null),
            ],
        ],

        'log' => [
            'driver' => 'log',
        ],

        'null' => [
            'driver' => 'null',
        ],
    ],
];
