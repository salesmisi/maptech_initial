import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ToastProvider } from './components/ToastProvider';
import ErrorBoundary from './components/ErrorBoundary';
import "../../css/app.css";
// Echo (realtime) bootstrap — optional, initializes window.Echo when configured
import './echo';

const CHUNK_RELOAD_KEY = 'maptech-chunk-reload-attempted';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

function isChunkLoadError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('chunkloaderror') ||
    message.includes('loading chunk') ||
    message.includes('css chunk loading failed')
  );
}

function reloadOnceForChunkError() {
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  window.location.reload();
}

window.addEventListener('error', (event) => {
  if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
    reloadOnceForChunkError();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason)) {
    reloadOnceForChunkError();
  }
});

const container = document.getElementById('app');
if (container) {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
