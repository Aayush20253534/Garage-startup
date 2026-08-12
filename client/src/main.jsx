import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import App from "./App.jsx";
import MobilePortraitGuard from "./components/common/MobilePortraitGuard.jsx";
import { store } from "./store";
import { queryClient } from "./lib/query/queryClient";
import { registerImageCacheWorker } from "./utils/imageCache";
import { installGlobalErrorReporting } from "./utils/errorReporter";
import { installChunkRecovery } from "./utils/chunkRecovery";
import { CampaignProvider } from "./context/CampaignContext";

import "./index.css";

console.info("Rovauto frontend build:", __APP_BUILD_ID__);

installChunkRecovery();
installGlobalErrorReporting();
registerImageCacheWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <CampaignProvider>
              <App />
              <MobilePortraitGuard />
            </CampaignProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </Provider>
    </HelmetProvider>
  </React.StrictMode>,
);
