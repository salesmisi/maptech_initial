<?php
// Creates an admin user in the local SQLite database with a known password.
$dbFile = __DIR__ . '/../database/database.sqlite';
if (!file_exists($dbFile)) { echo "ERROR: database file not found\n"; exit(1); }

$email = $argv[1] ?? 'admin@local.test';
$passwordPlain = $argv[2] ?? 'Password123!';
$fullname = $argv[3] ?? 'Local Admin';

try {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Check for existing email
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $exists = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($exists) {
        echo "EXISTS: user with email $email already exists (id={$exists['id']})\n";
        exit(0);
    }

    $hash = password_hash($passwordPlain, PASSWORD_BCRYPT);
    $now = date('Y-m-d H:i:s');
    $insert = $pdo->prepare('INSERT INTO users (fullname, email, password, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $insert->execute([$fullname, $email, $hash, 'admin', 'Active', $now, $now]);
    $id = $pdo->lastInsertId();
    echo "CREATED: id=$id email=$email password=$passwordPlain\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
