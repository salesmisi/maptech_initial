import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ToastProvider } from './components/ToastProvider';
import ErrorBoundary from './components/ErrorBoundary';
import "../../css/app.css";
// Echo (realtime) bootstrap — optional, initializes window.Echo when configured
import './echo';

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
