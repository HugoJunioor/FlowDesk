import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { branding } from "./config/brandingLoader";

document.title = `${branding.name} - ${branding.subtitle}`;

createRoot(document.getElementById("root")!).render(<App />);
