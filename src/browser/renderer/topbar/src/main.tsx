import React from "react";
import ReactDOM from "react-dom/client";
import { TopBarApp } from "./TopBarApp";
import "./index.css";

ReactDOM.createRoot(document.querySelector("#root")!).render(
  <React.StrictMode>
    <TopBarApp />
  </React.StrictMode>,
);
