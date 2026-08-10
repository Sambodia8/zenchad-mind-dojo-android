import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { startBikeQuestRuntime } from "./bikeQuestRuntime";
import { startRunningNativeGeolocationBridge } from "./runningNativeGeolocationBridge";
import { startRunningRuntime } from "./runningRuntime";
import { startRunningRouteRuntime } from "./runningRouteRuntime";
import { startRunningRoutePreviewRuntime } from "./runningRoutePreviewRuntime";
import { startRunningCampaignRuntime } from "./runningCampaignRuntime";
import { startRunningStoryRuntime } from "./runningStoryRuntime";
import { startRunningNativeStoryRuntime } from "./runningNativeStoryRuntime";
import { startRunningNativeStoryRouteSync } from "./runningNativeStoryRouteSync";
import { usesNativeStoryDirector } from "./runningNativeStory";
import { startRunningStoryResultsRuntime } from "./runningStoryResultsRuntime";
import { startRunningProgressionRuntime } from "./runningProgressionRuntime";
import { startRunningElevationRuntime } from "./runningElevationRuntime";
import { loadData } from "./storage";
import { startAppearanceController } from "./theme";
import "./styles.css";
import "./bikeQuest.css";
import "./bikeQuestMedia.css";
import "./bikeQuestPolish.css";
import "./bikeQuestRuntime.css";
import "./runningMode.css";
import "./runningInsights.css";
import "./runningNavigation.css";
import "./runningCampaign.css";
import "./runningStoryRuntime.css";
import "./runningStoryResults.css";
import "./runningProgression.css";
import "./runningElevation.css";
import "./theme.css";

startBikeQuestRuntime();
startRunningNativeGeolocationBridge();
startRunningRuntime();
startRunningRouteRuntime();
startRunningRoutePreviewRuntime();
startRunningCampaignRuntime();
if (usesNativeStoryDirector()) {
  startRunningNativeStoryRouteSync();
  startRunningNativeStoryRuntime();
} else {
  startRunningStoryRuntime();
}
startRunningStoryResultsRuntime();
startRunningProgressionRuntime();
startRunningElevationRuntime();
startAppearanceController(loadData().preferences.appearanceMode);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
