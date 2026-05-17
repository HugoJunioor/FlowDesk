import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "path";
import stateSyncPlugin from "./scripts/stateSync.mjs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

// HTTPS auto-assinado em producao habilita Web Crypto (PBKDF2, clipboard, etc)
// mesmo quando acessado via IP de rede/VPN. Em dev mantem HTTP para HMR rapido.
// Pode ser desligado com VITE_DISABLE_HTTPS=1.
const enableHttps = process.env.VITE_DISABLE_HTTPS !== "1";

export default defineConfig(({ command }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      overlay: false,
      clientPort: 8080,
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    allowedHosts: true,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      // CSP restritivo: sem unsafe-eval em prod. 'unsafe-inline' fica em
      // style-src porque shadcn/Tailwind usam estilos inline; script fica
      // limitado a 'self'. Conexoes apenas para a propria origem.
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self'",
        // Google Fonts: stylesheet em fonts.googleapis.com
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        // Avatars Slack vem de slack-edge.com (carrega como img)
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https://fonts.gstatic.com",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    },
  },
  // basicSsl gera certificado self-signed na primeira execucao.
  // Aplicado em dev e preview quando VITE_DISABLE_HTTPS != "1".
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), stateSyncPlugin(), ...(enableHttps && command !== "build" ? [basicSsl()] : [])],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
