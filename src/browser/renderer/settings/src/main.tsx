/// <reference types="vite/client" />
import React from "react";
import ReactDOM from "react-dom/client";
import { SettingsApp } from "./SettingsApp";
import "./index.css";

ReactDOM.createRoot(document.querySelector("#root")!).render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>,
);
