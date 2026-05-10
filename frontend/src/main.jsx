import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

if (localStorage.getItem("light-mode") === "true") {
  document.body.classList.add("light-mode");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
