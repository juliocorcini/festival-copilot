import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { registerServiceWorker } from "./app/registerSW";
import { initInstallCapture } from "./app/pwaInstall";
import { initHaptics } from "./lib/haptics";
import "./styles.css";

// Capture `beforeinstallprompt` before any screen mounts (it fires once, early).
initInstallCapture();

// Global tap haptics for every control (no-op on iOS / when disabled in Settings).
initHaptics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
