<?php
$dbFile = __DIR__ . '/../database/database.sqlite';
if (!file_exists($dbFile)) { echo "ERROR: database file not found\n"; exit(1); }
try {
    $pdo = new PDO('sqlite:' . $dbFile);
    $stmt = $pdo->query("PRAGMA table_info('users')");
    $cols = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($cols, JSON_PRETTY_PRINT) . "\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
