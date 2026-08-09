import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { startBikeQuestRuntime } from "./bikeQuestRuntime";
import { startRunningNativeGeolocationBridge } from "./runningNativeGeolocationBridge";
import { loadData } from "./storage";
import { startAppearanceController } from "./theme";
import "./styles.css";
import "./bikeQuest.css";
import "./bikeQuestMedia.css";
import "./bikeQuestPolish.css";
import "./bikeQuestRuntime.css";
import "./runningMode.css";
import "./runningInsights.css";
import "./theme.css";

startBikeQuestRuntime();
startRunningNativeGeolocationBridge();
startAppearanceController(loadData().preferences.appearanceMode);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
