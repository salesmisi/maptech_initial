import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ToastProvider } from './components/ToastProvider';
import "../../css/app.css";
// Echo (realtime) bootstrap — optional, initializes window.Echo when configured
import './echo';

ReactDOM.createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);
