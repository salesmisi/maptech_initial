<?php
// Boot the Laravel app and report the active DB connection and database name
chdir(__DIR__ . '/..');
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    $default = $app['config']['database.default'] ?? 'unknown';
    $driver = $app['config']["database.connections.$default.driver"] ?? 'unknown';
    $connection = $app->make('db')->connection();
    $databaseName = $connection->getDatabaseName();
    echo "default_connection: $default\n";
    echo "driver: $driver\n";
    echo "database: " . ($databaseName === null ? 'null' : $databaseName) . "\n";
    // also show DSN for PDO if available
    try {
        $pdo = $connection->getPdo();
        $attrs = [];
        $attrs[] = 'inTransaction=' . (int)$pdo->inTransaction();
        echo "pdo_ok: 1\n";
    } catch (Exception $e) {
        echo "pdo_ok: 0\n";
        echo "pdo_error: " . $e->getMessage() . "\n";
        exit(1);
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
