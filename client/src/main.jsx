import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import App from "./App.jsx";
import { store } from "./store";
import { registerImageCacheWorker } from "./utils/imageCache";
import { installGlobalErrorReporting } from "./utils/errorReporter";
import { installChunkRecovery } from "./utils/chunkRecovery";

import "./index.css";

console.info("Rovauto frontend build:", __APP_BUILD_ID__);

const isSupportShell =
  document.documentElement.dataset.appShell === "support";

const installPromptKey = isSupportShell
  ? "__ROVAUTO_SUPPORT_INSTALL_PROMPT__"
  : "__ROVAUTO_INSTALL_PROMPT__";
const installPromptEvent = isSupportShell
  ? "rovauto-support-install-ready"
  : "rovauto-install-ready";

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window[installPromptKey] = event;
  window.dispatchEvent(new Event(installPromptEvent));
});

window.addEventListener("appinstalled", () => {
  window[installPromptKey] = null;
});

installChunkRecovery();
installGlobalErrorReporting();
registerImageCacheWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      </Provider>
    </HelmetProvider>
  </React.StrictMode>,
);
