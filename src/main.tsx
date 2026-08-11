import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { startBikeQuestRuntime } from "./bikeQuestRuntime";
import { startRunningNativeGeolocationBridge } from "./runningNativeGeolocationBridge";
import { startRunningFinishGuardRuntime } from "./runningFinishGuardRuntime";
import { startRunningRuntime } from "./runningRuntime";
import { startRunningRouteRuntime } from "./runningRouteRuntime";
import { startRunningRouteFallbackRuntime } from "./runningRouteFallbackRuntime";
import { startRunningRoutePreviewRuntime } from "./runningRoutePreviewRuntime";
import { startRunningCampaignRuntime } from "./runningCampaignRuntime";
import { startRunningStoryRuntime } from "./runningStoryRuntime";
import { startRunningNativeStoryRuntime } from "./runningNativeStoryRuntime";
import { startRunningNativeStoryRouteSync } from "./runningNativeStoryRouteSync";
import { usesNativeStoryDirector } from "./runningNativeStory";
import { startRunningStoryResultsRuntime } from "./runningStoryResultsRuntime";
import { startRunningStoryMapMarkersRuntime } from "./runningStoryMapMarkersRuntime";
import { startRunningProgressionRuntime } from "./runningProgressionRuntime";
import { startRunningRewardBonusRuntime } from "./runningRewardBonusRuntime";
import { startRunningElevationRuntime } from "./runningElevationRuntime";
import { startRunningHistoryEnrichmentRuntime } from "./runningHistoryEnrichmentRuntime";
import { startRunningHealthRuntime } from "./runningHealthRuntime";
import { startRunningDiagnosticsRuntime } from "./runningDiagnosticsRuntime";
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
import "./runningRouteFallback.css";
import "./runningCampaign.css";
import "./runningStoryRuntime.css";
import "./runningStoryAudio.css";
import "./runningStoryResults.css";
import "./runningStoryMapMarkers.css";
import "./runningProgression.css";
import "./runningRewardBonus.css";
import "./runningElevation.css";
import "./runningHistoryEnrichment.css";
import "./runningHealth.css";
import "./runningDiagnostics.css";
import "./theme.css";

startBikeQuestRuntime();
startRunningNativeGeolocationBridge();
startRunningFinishGuardRuntime();
startRunningRuntime();
startRunningRouteRuntime();
startRunningRouteFallbackRuntime();
startRunningRoutePreviewRuntime();
startRunningCampaignRuntime();
if (usesNativeStoryDirector()) {
  startRunningNativeStoryRouteSync();
  startRunningNativeStoryRuntime();
} else {
  startRunningStoryRuntime();
}
startRunningStoryResultsRuntime();
startRunningStoryMapMarkersRuntime();
startRunningProgressionRuntime();
startRunningRewardBonusRuntime();
startRunningElevationRuntime();
startRunningHistoryEnrichmentRuntime();
startRunningHealthRuntime();
startRunningDiagnosticsRuntime();
startAppearanceController(loadData().preferences.appearanceMode);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
