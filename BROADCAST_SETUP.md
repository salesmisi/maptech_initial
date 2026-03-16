Configuring realtime broadcasting (Pusher or laravel-websockets)

This project already includes client-side Echo/Pusher integration at:
- resources/js/src/echo.ts

The Laravel server uses the `pusher` driver when env vars are present; otherwise it falls back to `log` (see config/broadcasting.php).

Two recommended options:

Option A — Use Pusher (hosted, easiest)
1. Create an app at https://pusher.com and get the App ID, Key, Secret, and Cluster.
2. In your project root, add these to your `.env` (or system env) — for local dev use values from Pusher dashboard:

PUSHER_APP_ID=your-app-id
PUSHER_APP_KEY=your-app-key
PUSHER_APP_SECRET=your-app-secret
PUSHER_APP_CLUSTER=your-cluster
BROADCAST_CONNECTION=pusher

3. Expose the key to the frontend by adding Vite env vars (in `.env`):

VITE_PUSHER_APP_KEY=${PUSHER_APP_KEY}
VITE_PUSHER_APP_CLUSTER=${PUSHER_APP_CLUSTER}
VITE_PUSHER_HOST=pusher.googleapis.com
VITE_PUSHER_PORT=443
VITE_PUSHER_SCHEME=https

4. Rebuild frontend and reload server:

# install node deps (if not already)
npm install
# start dev frontend
npm run dev
# start Laravel app
php artisan serve

5. Verify:
- Admin UI (Audit Logs) should have Echo connected (open browser console to check `window.Echo`).
- When users log in, events should be delivered via Pusher and admin UI will refresh.

Option B — Self-hosted with beyondcode/laravel-websockets (no external Pusher account)
This is recommended for local development and private servers.

1. Install the package:

composer require beyondcode/laravel-websockets

2. Publish config and migration:

php artisan vendor:publish --provider="BeyondCode\LaravelWebSockets\WebSocketsServiceProvider" --tag="migrations"
php artisan vendor:publish --provider="BeyondCode\LaravelWebSockets\WebSocketsServiceProvider" --tag="config"
php artisan migrate

3. Update `.env` with local Pusher-like settings (example):

BROADCAST_CONNECTION=pusher
PUSHER_APP_ID=local
PUSHER_APP_KEY=local
PUSHER_APP_SECRET=local
PUSHER_APP_CLUSTER=mt1
PUSHER_HOST=127.0.0.1
PUSHER_PORT=6001
PUSHER_SCHEME=http

VITE_PUSHER_APP_KEY=${PUSHER_APP_KEY}
VITE_PUSHER_APP_CLUSTER=${PUSHER_APP_CLUSTER}
VITE_PUSHER_HOST=${PUSHER_HOST}
VITE_PUSHER_PORT=${PUSHER_PORT}
VITE_PUSHER_SCHEME=${PUSHER_SCHEME}

4. Update `config/broadcasting.php` (already prepared in this repo) — ensure `pusher.options.host`/port/scheme read from env (this project already does this).

5. Start the websockets server and Laravel app (in separate terminals):

# start websockets server
php artisan websockets:serve

# start Laravel
php artisan serve

# start frontend dev
npm run dev

6. Verify:
- Open Admin UI and check browser console for Echo connection (`window.Echo`).
- Login as an employee in another browser; admin Echo should receive `AuditLogCreated` and refresh the audit logs.

Troubleshooting
- If `window.Echo` is null, check that `VITE_PUSHER_APP_KEY` is present and not a placeholder. The client code in `resources/js/src/echo.ts` will not initialise Echo when the key is empty.
- Check `php artisan websockets:serve` output for incoming connections.
- Ensure `BROADCAST_CONNECTION` is set to `pusher` in `.env` for realtime delivery (otherwise Laravel uses `log` driver which only writes events to logs, no realtime push).
- For HTTPS in production, set `PUSHER_SCHEME=https` and `PUSHER_PORT=443` and ensure `forceTLS`/`useTLS` are enabled in the client (edit `resources/js/src/echo.ts` if required).

Extra: quick verification curl
- Check API returns audit logs: `curl -s --cookie "XSRF-TOKEN=<token>" http://127.0.0.1:8000/api/admin/audit-logs` (or use your browser session).

If you want, I can:
- Add example `.env.example` entries for local websockets.
- Install and configure `beyondcode/laravel-websockets` automatically (I can add composer install instructions and basic config patches).
- Create a small debug route to check broadcast connection health.

Tell me which option you prefer and I will apply the changes or help run the commands locally.
