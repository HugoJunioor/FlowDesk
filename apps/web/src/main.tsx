import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { branding } from "./config/brandingLoader";
import { initStateSync, installLocalStorageInterceptor } from "./lib/stateSync";

document.title = `${branding.name} - ${branding.subtitle}`;

// Intercepta localStorage.setItem para sincronizar com servidor automaticamente
installLocalStorageInterceptor();

// Sincroniza estado (usuarios, overrides, grupos, regras) com servidor
// antes de renderizar. Se offline, continua usando localStorage.
initStateSync().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
