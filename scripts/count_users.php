<?php
try {
    $pdo = new PDO('sqlite:database/database.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $count = $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    echo "USERS_COUNT:" . $count . "\n";
} catch (Exception $e) {
    echo 'ERROR: '.$e->getMessage() . "\n";
}
