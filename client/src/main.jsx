import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import { store } from "./store";
import { registerImageCacheWorker } from "./utils/imageCache";
import { installGlobalErrorReporting } from "./utils/errorReporter";
import { installChunkRecovery } from "./utils/chunkRecovery";

import "./index.css";

console.info("Rovauto frontend build:", __APP_BUILD_ID__);

installChunkRecovery();
installGlobalErrorReporting();
registerImageCacheWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
