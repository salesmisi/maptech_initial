// Echo bootstrap for realtime events. Configure .env with PUSHER vars.
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Expose Pusher globally for libraries that expect it
(window as any).Pusher = Pusher;

const key = import.meta.env.VITE_PUSHER_APP_KEY || '';
const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER || '';
const host = import.meta.env.VITE_PUSHER_HOST || (window.location.hostname);
const port = import.meta.env.VITE_PUSHER_PORT || import.meta.env.VITE_PUSHER_PORT || undefined;

// Only initialise Echo if a real Pusher key is provided. This prevents noisy
// client-side errors when no websocket server is running or Pusher isn't configured.
if (key && key !== '' && key !== 'your-pusher-app-key') {
  try {
    (window as any).Echo = new Echo({
      broadcaster: 'pusher',
      key,
      cluster,
      wsHost: host,
      wsPort: port ? Number(port) : undefined,
      wssPort: port ? Number(port) : undefined,
      forceTLS: false,
      encrypted: false,
      disableStats: true,
      enabledTransports: ['ws', 'wss'],
      auth: {
        headers: {
          // Laravel Sanctum will need the XSRF token for private channels
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        }
      }
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Failed to initialize Echo:', e);
  }
} else {
  // No valid key found — don't initialise Echo to avoid connection errors.
  (window as any).Echo = null;
}
