<?php
if ($argc < 2) {
    echo "Usage: php test_token_request.php <token>\n";
    exit(1);
}
$token = $argv[1];
$opts = [
    'http' => [
        'method' => 'GET',
        'header' => [
            'Accept: application/json',
            'Authorization: Bearer ' . $token,
        ],
        'ignore_errors' => true,
        'timeout' => 10,
    ],
];
$ctx = stream_context_create($opts);
$r = @file_get_contents('http://127.0.0.1:8000/api/admin/notifications', false, $ctx);
if (isset($http_response_header)) echo implode("\n", $http_response_header) . "\n\n";
echo substr($r, 0, 4000) . (strlen($r) > 4000 ? "\n...[truncated]\n" : "\n");
