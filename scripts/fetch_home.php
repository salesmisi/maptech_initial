<?php
try {
    $opts = ['http' => ['method' => 'GET','timeout'=>5]];
    $context = stream_context_create($opts);
    $s = @file_get_contents('http://127.0.0.1:8000/', false, $context);
    if ($s === false) {
        echo "ERROR_FETCH\n";
        if (isset($http_response_header)) echo implode("\n", $http_response_header) . "\n";
        exit(1);
    }
    $snippet = strlen($s) > 500 ? substr($s,0,500).'...' : $s;
    echo "OK\n";
    echo $snippet . "\n";
} catch (Exception $e) {
    echo 'ERROR: ' . $e->getMessage() . "\n";
}
