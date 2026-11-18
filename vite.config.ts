import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ConoBot runs inside a Tauri webview. The dev server is fixed to 1420 so
// `tauri.conf.json` can point at it reliably.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
    watch: {
      // The Rust crate is rebuilt by cargo, not by Vite.
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    // Tauri ships a modern webview on every platform (WebView2 / WKWebView / WebKitGTK).
    target: ["es2021", "chrome105", "safari14"],
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 1400,
  },
});
