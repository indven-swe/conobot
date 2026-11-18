import { createRoot } from "react-dom/client";
import App from "@/App";
import { AppProvider } from "@/state/AppState";
import "@/styles/globals.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element missing");

// Disable the webview's default context menu outside of text fields; this is a
// desktop app, not a web page.
window.addEventListener("contextmenu", (event) => {
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
  event.preventDefault();
});

createRoot(container).render(
  <AppProvider>
    <App />
  </AppProvider>,
);
