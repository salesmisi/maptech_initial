<?php
if ($argc < 1) {
    // token will be read from last_token.txt
}
$tokenFile = __DIR__ . '/last_token.txt';
if (!file_exists($tokenFile)) {
    echo "Token file not found. Run scripts/create_token.php first.\n";
    exit(1);
}
$token = trim(file_get_contents($tokenFile));

$data = http_build_query([
    'title' => 'Preview test',
    'message' => 'Preview via script',
    'roles' => ['Employee'],
    'preview' => true,
]);

$opts = [
    'http' => [
        'method' => 'POST',
        'header' => [
            'Accept: application/json',
            'Content-Type: application/x-www-form-urlencoded',
            'Authorization: Bearer ' . $token,
        ],
        'content' => $data,
        'ignore_errors' => true,
    ],
];
$ctx = stream_context_create($opts);
$r = @file_get_contents('http://127.0.0.1:8000/api/admin/notifications/announce', false, $ctx);
if (isset($http_response_header)) echo implode("\n", $http_response_header) . "\n\n";
echo $r;
