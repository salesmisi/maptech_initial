#!/bin/sh
set -e

# Config cache runs at startup so it picks up Railway's runtime env vars
# (APP_KEY, DATABASE_URL, etc. are not available at Docker build time)
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Create the storage symlink if it doesn't already exist
php artisan storage:link --force 2>/dev/null || true

# Start Laravel dev server
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8080}"
