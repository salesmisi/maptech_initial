<?php
try {
    $pdo = new PDO('sqlite:database/database.sqlite');
    $stmt = $pdo->query("PRAGMA table_info('subdepartments')");
    $cols = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($cols, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo 'ERROR: ' . $e->getMessage();
}
