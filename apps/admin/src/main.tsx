import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (err) {
  console.error("[Admin] Failed to render:", err);
  document.getElementById("root")!.innerHTML =
    '<div style="display:flex;min-height:100vh;align-items:center;justify-content:center;font-family:sans-serif"><p>Failed to load. Please refresh.</p></div>';
}
