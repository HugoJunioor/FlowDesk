import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stateSyncPlugin = require("./scripts/stateSync.cjs");

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "0.0.0.0",           // bind em todas as interfaces (permite acesso remoto via VPN)
    port: 8080,
    strictPort: true,          // falha em vez de escolher outra porta
    allowedHosts: true,        // aceita qualquer hostname (necessario para acesso via VPN/IP)
    hmr: {
      overlay: false,
      clientPort: 8080,   // garante que o HMR websocket usa a mesma porta que o cliente acessou
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    allowedHosts: true,
    headers: {
      // Forca o navegador a sempre buscar versao mais recente (sem cache)
      // Essencial no modo share para que o F5 pegue novos builds imediatamente
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  },
  plugins: [react(), stateSyncPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
});
