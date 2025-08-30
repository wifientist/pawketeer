// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";      // Tailwind v4 entry (added below)
import "./App.css";        // keep existing component styles during migration
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
