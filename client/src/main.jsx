import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { store } from "./store";
import "./index.css";

const reloadOnStaleChunk = (error) => {
  const message = String(error?.message || error?.reason?.message || error || "");
  if (!/Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk/i.test(message)) {
    return;
  }

  const reloadKey = `rov_chunk_reload_attempted:${window.location.pathname}`;
  if (sessionStorage.getItem(reloadKey) === "1") {
    return;
  }

  sessionStorage.setItem(reloadKey, "1");

  const url = new URL(window.location.href);
  url.searchParams.set("rov_reload", String(Date.now()));
  window.location.replace(url.toString());
};

window.addEventListener("error", (event) => reloadOnStaleChunk(event.error || event.message));
window.addEventListener("unhandledrejection", (event) => reloadOnStaleChunk(event.reason));

window.setTimeout(() => {
  Object.keys(sessionStorage)
    .filter((key) => key.startsWith("rov_chunk_reload_attempted:"))
    .forEach((key) => sessionStorage.removeItem(key));
}, 5000);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
