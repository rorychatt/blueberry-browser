import React from "react";
import ReactDOM from "react-dom/client";
import { SidebarApp } from "./SidebarApp";
import "./index.css";

ReactDOM.createRoot(document.querySelector("#root")!).render(
  <React.StrictMode>
    <SidebarApp />
  </React.StrictMode>,
);
