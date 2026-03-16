<?php
$pdo = new PDO('sqlite:' . __DIR__ . '/../database/database.sqlite');
$res = $pdo->query("PRAGMA table_info('users')");
if (!$res) {
    echo "no result\n";
    exit(1);
}
foreach ($res as $row) {
    echo implode('|', [$row['cid'], $row['name'], $row['type'], $row['notnull'], $row['dflt_value'], $row['pk']]) . PHP_EOL;
}
