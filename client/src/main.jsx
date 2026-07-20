import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import App from "./App.jsx";
import MobilePortraitGuard from "./components/common/MobilePortraitGuard.jsx";
import { store } from "./store";
import { registerImageCacheWorker } from "./utils/imageCache";
import { installGlobalErrorReporting } from "./utils/errorReporter";
import { installChunkRecovery } from "./utils/chunkRecovery";

import "./index.css";

console.info("Rovauto frontend build:", __APP_BUILD_ID__);

const appShell = document.documentElement.dataset.appShell || "main";

const INSTALL_PROMPT_CONFIG = {
  main: {
    key: "__ROVAUTO_INSTALL_PROMPT__",
    event: "rovauto-install-ready",
  },
  support: {
    key: "__ROVAUTO_SUPPORT_INSTALL_PROMPT__",
    event: "rovauto-support-install-ready",
  },
  admin: {
    key: "__ROVAUTO_ADMIN_INSTALL_PROMPT__",
    event: "rovauto-admin-install-ready",
  },
  intern: {
    key: "__ROVAUTO_INTERN_INSTALL_PROMPT__",
    event: "rovauto-intern-install-ready",
  },
  garage: {
    key: "__ROVAUTO_GARAGE_INSTALL_PROMPT__",
    event: "rovauto-garage-install-ready",
  },
};

const installPromptConfig =
  INSTALL_PROMPT_CONFIG[appShell] || INSTALL_PROMPT_CONFIG.main;
const installPromptKey = installPromptConfig.key;
const installPromptEvent = installPromptConfig.event;

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
          <MobilePortraitGuard />
        </BrowserRouter>
      </Provider>
    </HelmetProvider>
  </React.StrictMode>,
);
