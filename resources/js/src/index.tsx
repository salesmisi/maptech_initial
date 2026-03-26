import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "../../css/app.css";

// Global error handlers to surface runtime errors in the UI for debugging
window.addEventListener('error', (e) => {
  try {
    // eslint-disable-next-line no-console
    console.error('Uncaught error', e.error || e.message || e);
    const stack = e.error?.stack || null;
    alert('Runtime error: ' + (e.error?.message || e.message || 'See console') + (stack ? '\n\nStack:\n' + stack : ''));
    try {
      // send to server for inspection
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          type: 'error',
          message: e.error?.message || e.message || null,
          stack: stack,
          fileName: e.filename || null,
          lineno: e.lineno || null,
          colno: e.colno || null,
          userAgent: navigator.userAgent,
        }),
        credentials: 'include',
      }).catch(() => {});
    } catch (_) {}
  } catch (err) {
    // ignore
  }
});

window.addEventListener('unhandledrejection', (e) => {
  try {
    // eslint-disable-next-line no-console
    console.error('Unhandled rejection', e.reason || e);
    const reasonMessage = (typeof e.reason === 'object' ? (e.reason?.message || e.reason) : e.reason);
    const reasonStack = e.reason?.stack || null;
    alert('Unhandled promise rejection: ' + (reasonMessage || 'See console') + (reasonStack ? '\n\nStack:\n' + reasonStack : ''));
    try {
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          type: 'unhandledrejection',
          reason: reasonMessage,
          stack: reasonStack,
          userAgent: navigator.userAgent,
        }),
        credentials: 'include',
      }).catch(() => {});
    } catch (_) {}
  } catch (err) {
    // ignore
  }
});

ReactDOM.createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
