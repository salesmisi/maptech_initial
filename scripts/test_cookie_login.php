<?php
$base = 'http://127.0.0.1:8000';

function request($method, $path, $headers = [], $body = null, $cookies = []) {
    $url = rtrim($GLOBALS['base'], '/') . $path;

    $opts = [
        'http' => [
            'method' => $method,
            'header' => [],
            'ignore_errors' => true,
            'timeout' => 20,
        ],
    ];

    if (!empty($cookies)) {
        $cookieStr = [];
        foreach ($cookies as $k => $v) $cookieStr[] = $k . '=' . $v;
        $headers['Cookie'] = implode('; ', $cookieStr);
    }

    foreach ($headers as $k => $v) {
        $opts['http']['header'][] = $k . ': ' . $v;
    }

    if ($body !== null) {
        if (is_array($body)) {
            $body = http_build_query($body);
            $opts['http']['header'][] = 'Content-Type: application/x-www-form-urlencoded';
        }
        $opts['http']['content'] = $body;
    }

    $context = stream_context_create($opts);
    $res = @file_get_contents($url, false, $context);
    $respHeaders = isset($http_response_header) ? $http_response_header : [];
    return [$res, $respHeaders];
}

function parseSetCookies($headers) {
    $cookies = [];
    foreach ($headers as $h) {
        if (stripos($h, 'Set-Cookie:') === 0) {
            $cookie = trim(substr($h, strlen('Set-Cookie:')));
            $parts = explode(';', $cookie);
            $nv = array_shift($parts);
            $eq = explode('=', $nv, 2);
            if (count($eq) == 2) {
                $cookies[trim($eq[0])] = trim($eq[1]);
            }
        }
    }
    return $cookies;
}

echo "Fetching CSRF cookie...\n";
list($r, $h) = request('GET', '/sanctum/csrf-cookie', ['Accept' => 'text/html']);
$cookies = parseSetCookies($h);
if (empty($cookies)) {
    echo "No Set-Cookie received from /sanctum/csrf-cookie\n";
    exit(1);
}
echo "Received cookies: " . implode(', ', array_keys($cookies)) . "\n";

if (!isset($cookies['XSRF-TOKEN'])) {
    echo "XSRF-TOKEN not present in cookies\n";
}

$xsrf = isset($cookies['XSRF-TOKEN']) ? urldecode($cookies['XSRF-TOKEN']) : '';

echo "Attempting login for admin@test.com...\n";
$loginHeaders = [
    'Accept' => 'application/json',
    'X-Requested-With' => 'XMLHttpRequest',
    'X-XSRF-TOKEN' => $xsrf,
];

list($lr, $lh) = request('POST', '/login', $loginHeaders, ['email' => 'admin@test.com', 'password' => 'Password123!'], $cookies);
$loginCookies = parseSetCookies($lh);
if (!empty($loginCookies)) {
    $cookies = array_merge($cookies, $loginCookies);
}

echo "Login response headers:\n";
foreach ($lh as $line) echo $line . "\n";

echo "Login body:\n";
echo substr($lr, 0, 2000) . (strlen($lr) > 2000 ? "\n...[truncated]\n" : "\n");

// If login body contains a token, use it as a bearer fallback for API calls
$loginData = json_decode($lr, true) ?: [];
$bearer = $loginData['token'] ?? null;

echo "\nRequesting /api/admin/notifications with cookies...\n";
// Prefer cookie-based request, but fall back to bearer token if provided by login response
$apiHeaders = [
    'Accept' => 'application/json',
    'X-Requested-With' => 'XMLHttpRequest',
    'X-XSRF-TOKEN' => $xsrf,
];

if ($bearer) {
    $apiHeaders['Authorization'] = 'Bearer ' . $bearer;
}

list($ar, $ah) = request('GET', '/api/admin/notifications', $apiHeaders, null, $cookies);

echo "API response headers:\n";
foreach ($ah as $line) echo $line . "\n";

echo "API body (truncated):\n";
echo substr($ar, 0, 4000) . (strlen($ar) > 4000 ? "\n...[truncated]\n" : "\n");

?>
