import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function loadTsModule(relativePath, imports = {}) {
  const filename = path.join(root, relativePath);
  const sourceText = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(sourceText, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText;
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier in imports) return imports[specifier];
    throw new Error(`Unexpected runtime import ${specifier} while testing ${relativePath}`);
  };
  new Function("exports", "module", "require", output)(module.exports, module, localRequire);
  return module.exports;
}

// An active run is a focused surface: Bike Quest's global resume dock must not cover
// its navigation or finish controls, and short phone screens must remain scrollable.
assert.match(source("src/bikeQuestRuntime.ts"), /function runningIsVisible\(\)/);
assert.match(source("src/bikeQuestRuntime.ts"), /focusMode \|\| runningIsVisible\(\)/);
assert.match(source("src/runningMode.css"), /html\.running-live-mode \.main-content[\s\S]*overflow-y: auto/);
assert.match(source("src/runningMode.css"), /html\.running-live-mode \.bike-quest-resume-dock/);
assert.doesNotMatch(source("src/screens/RunningModeScreen.tsx"), /Start a fresh run/);
assert.match(source("src/screens/RunningModeScreen.tsx"), /<Check \/> Done<\/button>/);
assert.doesNotMatch(source("src/screens/RunningModeScreen.tsx"), /Route privacy preview|Optional run photos|No feed, no leaderboard/);
const runningScreenSource = source("src/screens/RunningModeScreen.tsx");
assert.match(runningScreenSource, /GPS tracks distance, pace and your activity/, "the Just Run choice must describe tracked activity, not a timer-only mode");
assert.match(runningScreenSource, /aria-expanded=\{expanded\}/, "the live Running With row must expose its collapsed state accessibly");
assert.match(runningScreenSource, /Scroll for story, route and finish/, "Story runs must make the scrollable continuation obvious");
assert.match(source("src/runningMode.css"), /\.running-active \.running-end-button\s*\{\s*position:\s*static/, "the finish action must stay in document flow instead of covering Story content");
assert.equal((runningScreenSource.match(/scheduleRunningReminder\(startedAt, next\.plannedMinutes\)/g) ?? []).length, 2, "both measured and Just Runs should schedule a reminder");
assert.equal((runningScreenSource.match(/void cancelRunningReminder\(\)/g) ?? []).length, 3, "banking, resetting, and replacing a session should cancel the reminder");
assert.match(source("src/native.ts"), /const RUNNING_REMINDER_NOTIFICATION_ID = 6201/);
assert.match(source("src/native.ts"), /Math\.max\(1, plannedMinutes\) \+ 15/);
assert.match(source("src/native.ts"), /Your run is still active\. Open ZenChad to finish and bank it when you are ready\./);
const homeSource = source("src/screens/HomeScreen.tsx");
assert.match(homeSource, /label: "Move"[\s\S]*detail: "Run or ride"/);
assert.match(homeSource, /label: "Stretch"[\s\S]*route: \{ name: "yoga" \}/);
assert.match(homeSource, /navigate\(\{ name: "running" \}\)/);
assert.match(homeSource, /navigate\(\{ name: "bike-quest" \}\)/);
assert.doesNotMatch(homeSource, /label: "Listen"/);

const story = loadTsModule("src/runningStory.ts");
const routes = loadTsModule("src/runningRouteDirector.ts");
const navigation = loadTsModule("src/runningNavigation.ts", {
  "./runningRouteDirector": { routeNeedsReroute: () => false }
});
const routePreview = loadTsModule("src/runningRoutePreviewRuntime.ts", {
  "./running": { loadRunSession: () => null },
  "./runningNavigation": { navigationArrowForManeuver: () => "↑", navigationStateForLocation: () => ({ nearestShapeIndex: 0 }) },
  "./runningRouteStore": { loadPlannedRunningRoute: () => null },
  "./runningStreetMap": { updateRunningStreetMap: () => {} }
});
const progression = loadTsModule("src/runningProgression.ts");
const storyChapters = loadTsModule("src/runningStoryChapters.ts");
const celebrationParticles = loadTsModule("src/celebrationParticles.ts");
const runningHype = loadTsModule("src/runningHype.ts");
const running = loadTsModule("src/running.ts", {
  "./data": { LEVEL_THRESHOLDS: [0, 60, 140, 235, 345, 520, 800, 1200, 1800] },
  "./runningStoryChapters": storyChapters
});

// Preparation is ordered, time-aware, resumable, and advances without duplicate awards.
assert.deepEqual(
  running.RUN_PREP_STEPS.map((step) => step.id),
  ["phone", "headphones", "clothes", "water", "shoes", "outside", "stretches"]
);
assert.match(running.RUN_PREP_STEPS[2].instruction, /Don't forget socks\./);
assert.match(
  running.prepStepInstruction(running.RUN_PREP_STEPS[0], new Date(2026, 7, 20, 21, 0)),
  /torch/i
);
assert.doesNotMatch(
  running.prepStepInstruction(running.RUN_PREP_STEPS[0], new Date(2026, 7, 20, 12, 0)),
  /torch/i
);
const prepStart = new Date(2026, 7, 20, 12, 0).getTime();
const prepSession = { ...running.createRunSession("quick", 30, prepStart), stage: "prep" };
const phoneCompletion = running.completeRunPrepStep(prepSession, prepStart + 30_000);
assert.equal(phoneCompletion?.step.id, "phone");
assert.equal(phoneCompletion?.next.prepStepIndex, 1);
const headphonesCompletion = running.completeRunPrepStep(phoneCompletion.next, prepStart + 30_001);
assert.equal(headphonesCompletion?.step.id, "headphones");
assert.equal(running.completeRunPrepStep(headphonesCompletion.next, prepStart + 30_002)?.step.id, "clothes");
const restartedPrep = running.restartRunPreparation(phoneCompletion.next, prepStart + 60_000);
assert.equal(restartedPrep.prepStepIndex, 0);
assert.deepEqual(restartedPrep.prepAwards, {});
assert.equal(restartedPrep.prepXp, 0);
const outsidePrep = { ...running.createRunSession("quick", 20, prepStart), stage: "prep", prepStepIndex: running.RUN_PREP_STEPS.findIndex((step) => step.id === "outside") };
const outsideCompletion = running.completeRunPrepStep(outsidePrep, prepStart + 60_000);
assert.equal(outsideCompletion?.next.stage, "prep", "destination warm-up remains after shoes and departure logistics");
assert.equal(running.RUN_PREP_STEPS[outsideCompletion?.next.prepStepIndex ?? 0].id, "stretches");
const warmupCompletion = running.skipRunPrepStep(outsideCompletion.next, prepStart + 61_000);
assert.equal(warmupCompletion?.next.stage, "warmup", "finishing or skipping the dynamic warm-up starts the separate GPS stage");
assert.equal(warmupCompletion?.next.runStartedAt, null, "the run timer must wait for an explicit start action");
const skippedPhone = running.skipRunPrepStep(prepSession, prepStart + 1_000);
assert.equal(skippedPhone?.next.prepStepIndex, 1, "a single preparation step can be skipped independently of run mode");
assert.equal(skippedPhone?.next.prepAwards.phone, 0, "skipping preparation never grants its XP");
const skippedAll = running.skipRemainingRunPreparation(prepSession, prepStart + 2_000);
assert.equal(skippedAll?.stage, "warmup", "skipping preparation still preserves the GPS warm-up boundary");
assert.equal(Object.keys(skippedAll?.prepAwards ?? {}).length, running.RUN_PREP_STEPS.length);

// Persisted run data is untrusted: a damaged GPS sample or numeric field must be
// discarded/sanitised rather than making resume or finish throw.
const localStore = new Map();
globalThis.localStorage = {
  getItem: (key) => localStore.get(key) ?? null,
  setItem: (key, value) => localStore.set(key, String(value)),
  removeItem: (key) => localStore.delete(key),
  clear: () => localStore.clear(),
  key: (index) => [...localStore.keys()][index] ?? null,
  get length() { return localStore.size; }
};
localStorage.setItem("zenchad_running_session_v1", JSON.stringify({
  ...running.createRunSession("just", 20, prepStart),
  stage: "active",
  runStartedAt: prepStart,
  distanceMeters: "broken",
  companionIds: ["yuna", "unknown", "katie", "yuna"],
  storyMissionId: 42,
  storyHeardChapterIds: ["briefing", "not-a-chapter", "contact"],
  points: [
    { lat: 53, lng: -2.4, accuracy: 5, at: prepStart, distanceFromStart: -20 },
    { lat: 999, lng: -2.4, accuracy: 5, at: prepStart + 1_000 },
    { lat: 53.1, lng: -2.4, accuracy: -1, at: prepStart + 2_000 },
    null
  ]
}));
const recoveredSession = running.loadRunSession();
assert.equal(recoveredSession?.mode, "just");
assert.equal(recoveredSession?.distanceMeters, 0);
assert.equal(recoveredSession?.points.length, 1, "malformed GPS samples must be removed on resume");
assert.equal(recoveredSession?.points[0].distanceFromStart, 0);
assert.deepEqual(recoveredSession?.companionIds, ["katie", "yuna"], "known companion tags survive resume in catalogue order");
assert.equal(recoveredSession?.storyMissionId, null);
assert.deepEqual(recoveredSession?.storyHeardChapterIds, [], "Just Run recovery drops stale Story chapter receipts");
assert.equal(recoveredSession?.version, 5, "resumed sessions migrate to the companion-tagging schema");
const freshJustRun = running.createRunSession("just", 30, prepStart);
assert.equal(freshJustRun.storyMissionId, null);
assert.deepEqual(freshJustRun.storyHeardChapterIds, []);
assert.equal(running.acceptsStoryCallback({ ...freshJustRun, stage: "active" }, freshJustRun.id), false, "Story callbacks are rejected by Just Run");
assert.equal(running.acceptsStoryCallback({ ...freshJustRun, mode: "story", stage: "active" }, "another-run"), false, "late Story callbacks cannot cross session boundaries");
assert.equal(running.acceptsStoryCallback({ ...freshJustRun, mode: "story", stage: "warmup" }, freshJustRun.id), false, "Story callbacks are rejected during prep and GPS warm-up");
assert.equal(running.acceptsStoryCallback({ ...freshJustRun, mode: "story", stage: "active" }, freshJustRun.id), true, "the active matching Story session accepts its callbacks");
assert.match(runningScreenSource, /clearRunningRouteState\(\)/, "starting a Just Run clears a previous planned route");
assert.match(runningScreenSource, /createRunSession\("just"/, "the stretch choice and direct start remain in the Just Run path");
assert.match(runningScreenSource, /RUN TIME[\s\S]*formatRunClock\(elapsedRunSeconds\)/, "the active HUD labels and places elapsed time before distance");
assert.match(source("src/runningMode.css"), /\.running-active \.running-primary-stat strong \{ font-size: clamp\(3\.4rem/, "the active HUD gives elapsed time the primary metric size");
localStorage.clear();

// The compact Run Hype List keeps equipment setup across workouts while status
// never carries a false "packed" result into the next session.
const defaultHype = runningHype.loadRunHypeEquipment();
assert.equal(defaultHype[0].id, "towel", "the sweat towel is first by personal importance");
assert.match(defaultHype[0].note, /sensory essential/i);
let hype = runningHype.createRunHypeChecklist("hype-run-1");
hype.statusByItem.towel = "ready";
hype.statusByItem.water = "not-needed";
hype.homePrepDone = true;
hype.travelMinutes = 35;
runningHype.saveRunHypeChecklist(hype);
assert.equal(runningHype.loadRunHypeChecklist("hype-run-1").travelMinutes, 35, "interrupted prep restores journey planning");
const nextHype = runningHype.createRunHypeChecklist("hype-run-2");
assert.equal(nextHype.statusByItem.towel, "outstanding", "packed status does not imply an item was packed for the next run");
assert.equal(nextHype.statusByItem.water, "not-needed", "a personal not-needed choice may be remembered without claiming an item was packed");
const sunset = runningHype.sunsetForLocation(51.5, -0.1, new Date(2026, 8, 24, 12));
assert.ok(sunset instanceof Date && sunset.getUTCHours() >= 16 && sunset.getUTCHours() <= 19, "GPS-based sunset is calculated for the planned location and date");
assert.equal(runningHype.sunsetForLocation(89, 0, new Date(2026, 5, 21)), null, "polar sunset estimates outside the supported latitude range are explicitly unknown");
assert.match(runningScreenSource, /I have these already/, "the list has a one-tap user-confirmed ready action");
assert.match(runningScreenSource, /homePrepDone: true/, "home and car logistics can be completed before travel");
assert.match(runningScreenSource, /startTrailheadDynamicWarmup/, "dynamic warm-up is available at the selected start point");
assert.match(runningScreenSource, /Yuna’s teatime is usually around 18:00/, "the companion-specific teatime reminder is conditional and approximate");
const browserStoryRuntime = source("src/runningStoryRuntime.ts");
assert.match(browserStoryRuntime, /state\.heardChapterIds\.includes\("contact"\) && completionRatio >= 0\.33/, "browser Story progression waits for heard Contact narration");
assert.match(browserStoryRuntime, /state\.heardChapterIds\.includes\("pursuit"\) && completionRatio >= 0\.64/, "browser Story progression waits for heard Pursuit narration");
assert.match(browserStoryRuntime, /state\.heardChapterIds\.includes\("complication"\) && completionRatio >= 0\.84/, "browser Story progression waits for heard Complication narration");
localStorage.clear();

const storyResults = loadTsModule("src/runningStoryResults.ts", {
  "./runningStoryChapters": storyChapters
});
const campaign = loadTsModule("src/runningCampaign.ts", {
  "./runningStoryResults": storyResults
});
storyResults.saveStoryRunResult({
  runId: "silent-run",
  missionId: "ghost-signal-001",
  missionTitle: "Ghost Signal",
  difficulty: "standard",
  chaseCount: 0,
  lastOutcome: "",
  helicopterEncountered: false,
  completedAt: prepStart,
  source: "browser",
  heardChapterIds: ["briefing", "contact"],
  playbackVerified: false
});
assert.equal(campaign.runningCampaignState().nextEpisode, 1, "banking a run must not skip an episode whose narration was not heard");
for (const chapterId of storyChapters.STORY_CHAPTER_IDS) storyResults.markStoryChapterHeard("ghost-signal-001", chapterId);
assert.equal(campaign.runningCampaignState().nextEpisode, 2, "replaying every missing chapter should safely unlock the next episode");
localStorage.clear();

const particlesA = celebrationParticles.createCelebrationParticles("run-a");
const particlesARepeat = celebrationParticles.createCelebrationParticles("run-a");
const particlesB = celebrationParticles.createCelebrationParticles("run-b");
assert.equal(particlesA.length, 88);
assert.deepEqual(particlesA, particlesARepeat, "a completed run gets stable confetti across React renders");
assert.notDeepEqual(particlesA, particlesB, "different runs should not receive the same confetti choreography");
assert.ok(new Set(particlesA.map((particle) => particle.duration.toFixed(4))).size > 70, "confetti pieces need genuinely varied fall speeds");
assert.ok(new Set(particlesA.map((particle) => particle.driftA.toFixed(2))).size > 70, "confetti pieces need genuinely varied paths");

localStorage.setItem("zenchad_running_profile_v1", JSON.stringify({
  version: 4,
  history: [{
    id: "legacy-run",
    mode: "just",
    plannedMinutes: 30,
    startedAt: prepStart,
    endedAt: prepStart + 60_000,
    companionIds: ["rtr", "invalid", "hana", "rtr"]
  }]
}));
const migratedCompanionProfile = running.loadRunningProfile();
assert.equal(migratedCompanionProfile.version, 5);
assert.deepEqual(migratedCompanionProfile.history[0].companionIds, ["hana", "rtr"], "history drops unknown and duplicate companion tags");
localStorage.clear();

// Recent pace uses the last 30 seconds of filtered run points and treats a stop as a stop,
// rather than turning a few metres of GPS drift into an alarming pace.
const paceNow = prepStart + 60_000;
const pacePoints = [
  { lat: 53, lng: -2.4, accuracy: 5, at: paceNow - 30_000, distanceFromStart: 100 },
  { lat: 53.0001, lng: -2.4, accuracy: 5, at: paceNow - 15_000, distanceFromStart: 175 },
  { lat: 53.0002, lng: -2.4, accuracy: 5, at: paceNow, distanceFromStart: 250 }
];
assert.equal(Math.round(running.rollingPaceSecondsPerKm(pacePoints, paceNow)), 200);
assert.equal(running.rollingPaceSecondsPerKm([
  { ...pacePoints[0], at: paceNow - 30_000, distanceFromStart: 250 },
  { ...pacePoints[2], at: paceNow, distanceFromStart: 258 }
], paceNow), null, "near-stationary GPS drift should read as stopped");
assert.equal(running.rollingPaceSecondsPerKm(pacePoints, paceNow + 16_000), null, "a stale GPS fix should not pretend to be live pace");

// Plausible, deterministic GPS data must preserve elapsed time while reporting a
// separate moving total. A stationary pause is not distance, pace, or a phantom PB.
const trackStart = prepStart + 100_000;
const pausedTrack = [
  { lat: 53, lng: -2.4, accuracy: 5, at: trackStart, distanceFromStart: 0 },
  { lat: 53.0009, lng: -2.4, accuracy: 5, at: trackStart + 25_000, distanceFromStart: 100 },
  { lat: 53.0018, lng: -2.4, accuracy: 5, at: trackStart + 50_000, distanceFromStart: 200 },
  { lat: 53.0027, lng: -2.4, accuracy: 5, at: trackStart + 75_000, distanceFromStart: 300 },
  { lat: 53.0036, lng: -2.4, accuracy: 5, at: trackStart + 100_000, distanceFromStart: 400 },
  { lat: 53.0036, lng: -2.4, accuracy: 5, at: trackStart + 220_000, distanceFromStart: 400 },
  { lat: 53.0045, lng: -2.4, accuracy: 5, at: trackStart + 245_000, distanceFromStart: 500 },
  { lat: 53.0054, lng: -2.4, accuracy: 5, at: trackStart + 270_000, distanceFromStart: 600 },
  { lat: 53.0063, lng: -2.4, accuracy: 5, at: trackStart + 295_000, distanceFromStart: 700 },
  { lat: 53.0072, lng: -2.4, accuracy: 5, at: trackStart + 320_000, distanceFromStart: 800 },
  { lat: 53.0081, lng: -2.4, accuracy: 5, at: trackStart + 345_000, distanceFromStart: 900 },
  { lat: 53.009, lng: -2.4, accuracy: 5, at: trackStart + 370_000, distanceFromStart: 1000 }
];
assert.equal(running.calculateMovingSeconds(pausedTrack), 250, "moving time excludes the 120-second pause");
const pausedSplits = running.calculateKilometreSplits(pausedTrack);
assert.equal(pausedSplits.length, 1);
assert.equal(pausedSplits[0].durationSeconds, 370, "split pace is honest elapsed time, including a pause during that kilometre");
assert.equal(running.calculateBestEfforts(pausedTrack).find((effort) => effort.key === "400m")?.durationSeconds, 100);
const teleportTrack = [...pausedTrack, { lat: 54, lng: -1, accuracy: 5, at: trackStart + 371_000, distanceFromStart: 31_000 }];
assert.equal(running.calculateKilometreSplits(teleportTrack).length, 1, "a one-second GPS teleport cannot create distance, splits, or PBs");

const routeLabel = running.routeNameFromManeuvers([
  { routeDistanceMeters: 20, streetNames: ["King Street"] },
  { routeDistanceMeters: 320, instruction: "Turn right onto King Street" },
  { routeDistanceMeters: 670, streetNames: ["Canal Road"] },
  { routeDistanceMeters: 990, streetNames: ["Station Lane"] }
], 1000);
assert.deepEqual(routeLabel.roadNames, ["King Street", "Canal Road"]);
assert.equal(routeLabel.routeName, "King Street · Canal Road");
assert.deepEqual(running.routeNameFromManeuvers([{ routeDistanceMeters: 0, streetNames: ["Unnamed Road"] }]), { routeName: "Recorded route", roadNames: [] });
const travelledName = running.routeNameFromRunPoints([
  { at: 0, lat: 53, lng: -2.4, accuracy: 5, distanceFromStart: 0, roadName: "Station Road" },
  { at: 1, lat: 53, lng: -2.4, accuracy: 5, distanceFromStart: 330, roadName: "Station Road" },
  { at: 2, lat: 53, lng: -2.4, accuracy: 5, distanceFromStart: 660, roadName: "Moss Lane" },
  { at: 3, lat: 53, lng: -2.4, accuracy: 5, distanceFromStart: 1000, roadName: "London Road" }
]);
assert.deepEqual(travelledName.roadNames, ["Station Road", "Moss Lane"]);
assert.equal(travelledName.routeName, "Station Road · Moss Lane", "generated names must sample roads actually travelled near the run thirds");

const firstCheckpoints = running.checkpointRewardsForProgress(0.51, {});
assert.deepEqual(firstCheckpoints.map((reward) => reward.id), ["25", "50"]);
assert.deepEqual(running.checkpointRewardsForProgress(1, { "25": firstCheckpoints[0], "50": firstCheckpoints[1] }).map((reward) => reward.id), ["75", "100"]);
assert.ok(running.calculateRunXp(120, 100, 20) < 10, "a short GPS test must not produce an outsized running XP payout");
const allCheckpoints = running.checkpointRewardsForProgress(1, {});
assert.ok(allCheckpoints.reduce((sum, reward) => sum + reward.zenPoints, 0) <= 5, "a full run must award no more than 5 ZP from checkpoints");
assert.ok(allCheckpoints.reduce((sum, reward) => sum + reward.dice, 0) <= 2, "a full run must award no more than 2 dice from checkpoints");
assert.deepEqual(
  running.distanceZenPointRewardsForProgress(5000, {}).map((reward) => reward.distanceMeters),
  [100, 300, 750, 1250, 2000, 2750, 3750, 5000],
  "distance Zen Points must follow the field-tested fast-start curve"
);
assert.deepEqual(
  running.distanceZenPointRewardsForProgress(1300, { "100m": running.RUN_DISTANCE_ZEN_POINT_REWARDS[0] }).map((reward) => reward.id),
  ["300m", "750m", "1.25km"],
  "restored sessions must not replay already-awarded distance Zen Points"
);
assert.equal(running.firstRunOfDayZenPoints([], prepStart), 3);
assert.equal(running.firstRunOfDayZenPoints([{ endedAt: prepStart }], prepStart + 1_000), 0);
const maximumPrepXp = running.RUN_PREP_STEPS.reduce((sum, step) => sum + step.baseXp + step.bonusXp, 0) + 5;
const thirtyMinuteRunXp = maximumPrepXp + running.calculateRunXp(30 * 60, 5000, 30) + allCheckpoints.reduce((sum, reward) => sum + reward.xp, 0);
const thirtyMinuteRunWithMaximumStreak = Math.round(thirtyMinuteRunXp * progression.runningStreakMultiplier(100));
const thirtyMinuteMeditationXp = 50 + Math.floor(30 * 60 / 6);
assert.ok(thirtyMinuteRunWithMaximumStreak <= thirtyMinuteMeditationXp, "equal-duration Running XP must remain below meditation even with the maximum streak multiplier");
const ordinaryEarlyRunXp = running.calculateRunXp(30 * 60, 5000, 30) + allCheckpoints.reduce((sum, reward) => sum + reward.xp, 0);
assert.equal(ordinaryEarlyRunXp, 100);
assert.deepEqual(
  [1, 2, 3, 4].map((runCount) => running.levelForXp(ordinaryEarlyRunXp * runCount)),
  [2, 3, 4, 5],
  "ordinary early runs should naturally reach levels 2, 3, 4, then 5"
);
const adaptive = running.adaptiveRunPlan([{ durationSeconds: 31 * 60, distanceMeters: 4200 }]);
assert.equal(adaptive.recommendedMinutes, 30);
assert.equal(adaptive.expectedDistanceMeters, 4100);

// Chase placement: only the explicitly agreed sudden-acceleration blockers are hard gates.
for (const context of [
  { atJunction: true },
  { atRoadCrossing: true },
  { onSteepDescent: true },
  { onStairs: true },
  { anchor: { kind: "junction" } },
  { anchor: { kind: "road-crossing" } },
  { anchor: { kind: "steep-descent" } },
  { anchor: { kind: "stairs" } }
]) {
  assert.equal(story.canTriggerChase(context), false, `chase should be blocked for ${JSON.stringify(context)}`);
}
assert.equal(story.canTriggerChase({ anchor: { kind: "open" } }), true);
assert.equal(story.canTriggerChase({ anchor: { kind: "cover" } }), true);

// Chase performance changes the fiction, never subtracts running XP.
assert.deepEqual(story.evaluateChase(3, 3).xpPenalty, 0);
assert.equal(story.evaluateChase(3, 3).kind, "escaped");
assert.equal(story.evaluateChase(3, 2.5).kind, "pressure");
assert.equal(story.evaluateChase(3, 1.5).kind, "caught-branch");
for (const achieved of [0.5, 1.8, 2.8, 4]) {
  assert.equal(story.evaluateChase(3, achieved).xpPenalty, 0);
}

const targetContext = {
  recentSpeedMps: 2.5,
  elapsedRunSeconds: 500,
  plannedRunSeconds: 1800,
  previousChases: []
};
const casual = story.chaseTarget({ ...targetContext, difficulty: "casual" });
const standard = story.chaseTarget({ ...targetContext, difficulty: "standard" });
const intense = story.chaseTarget({ ...targetContext, difficulty: "intense" });
assert.ok(casual.targetSpeedMps < standard.targetSpeedMps);
assert.ok(standard.targetSpeedMps < intense.targetSpeedMps);
const lateTarget = story.chaseTarget({ ...targetContext, difficulty: "standard", elapsedRunSeconds: 1650 });
assert.ok(lateTarget.increaseFraction <= standard.increaseFraction, "late-run chase should not demand a bigger surge");

const cover = story.chooseCoverAnchor([
  { id: "too-close", kind: "cover", distanceMeters: 50, confidence: 1 },
  { id: "uncertain", kind: "cover", distanceMeters: 400, confidence: 0.4 },
  { id: "good", kind: "cover", distanceMeters: 520, confidence: 0.9 }
], 100);
assert.equal(cover?.id, "good");
assert.equal(story.routeAnchorAllowsShortcut({ id: "x", kind: "neutral", distanceMeters: 0, confidence: 0.79 }), false);
assert.equal(story.routeAnchorAllowsShortcut({ id: "x", kind: "neutral", distanceMeters: 0, confidence: 0.8 }), true);
let budget = story.createStoryDirectorBudget(2);
budget = story.reserveStoryAiCall(budget);
assert.equal(budget.usedCalls, 1);
budget = story.reserveStoryAiCall(budget);
assert.equal(budget.usedCalls, 2);
assert.equal(story.reserveStoryAiCall(budget), null, "AI call budget must be a hard ceiling");

function candidate(overrides = {}) {
  return {
    id: "route",
    geometry: [{ lat: 1, lng: 1 }, { lat: 1.001, lng: 1.001 }],
    estimatedMinutes: 30,
    distanceMeters: 4000,
    endsNearStart: true,
    endDistanceFromStartMeters: 100,
    noveltyScore: 0.5,
    interestScore: 0.5,
    familiarityScore: 0.5,
    gameOpportunityScore: 0.5,
    routeConfidence: 0.9,
    uncertainShortcutCount: 0,
    ...overrides
  };
}

assert.equal(routes.routeCandidateIsUsable(candidate({ uncertainShortcutCount: 1 })), false, "uncertain shortcuts must be rejected");
assert.equal(routes.routeCandidateIsUsable(candidate()), true);
const familiar = candidate({ id: "familiar", noveltyScore: 0.15, familiarityScore: 0.95, gameOpportunityScore: 0.25 });
const novelGame = candidate({ id: "novel", noveltyScore: 0.95, familiarityScore: 0.1, gameOpportunityScore: 0.95 });
assert.equal(routes.chooseRunningRoute([familiar, novelGame], { mode: "story", plannedMinutes: 30, start: { lat: 1, lng: 1 } }).candidate.id, "novel");
assert.equal(routes.chooseRunningRoute([familiar, novelGame], { mode: "quick", plannedMinutes: 30, start: { lat: 1, lng: 1 } }).candidate.id, "familiar");
assert.equal(routes.offRouteInstruction("quick"), "reroute-silently");
assert.match(routes.offRouteInstruction("story"), /Change of plan/i);

// Navigation must relay the provider's stored maneuver direction; it must never
// reverse a turn by attempting to infer it from the route geometry or live DOM.
const routeForNavigation = {
  geometry: [{ lat: 53, lng: -2.4 }, { lat: 53.0005, lng: -2.4 }, { lat: 53.001, lng: -2.4 }],
  cumulativeMeters: [0, 55, 111],
  distanceMeters: 111,
  estimatedMinutes: 1,
  maneuvers: [
    { id: "left", instruction: "Turn left onto Right Way", verbalAlert: "Turn left", verbalInstruction: "Turn left", routeDistanceMeters: 55 },
    { id: "right", instruction: "Turn right onto Left Lane", verbalAlert: "Turn right", verbalInstruction: "Turn right", routeDistanceMeters: 111 }
  ]
};
assert.equal(navigation.navigationArrowForManeuver(routeForNavigation.maneuvers[0]), "↰");
assert.equal(navigation.navigationArrowForManeuver(routeForNavigation.maneuvers[1]), "↱");
const leftState = navigation.navigationStateForLocation(routeForNavigation, routeForNavigation.geometry[0]);
assert.equal(leftState.nextManeuver.instruction, "Turn left onto Right Way");
const leftCue = navigation.cueForNavigationState(leftState, {});
assert.match(leftCue.speech, /In 60 m, under a minute away, Turn left/i);
assert.equal(navigation.formatNavigationTime(60), "1 min");
assert.equal(routePreview.runnerHeadingDegrees([{ lat: 53, lng: -2.4, heading: 275 }], routeForNavigation, 0), 275);
assert.equal(Math.round(routePreview.runnerHeadingDegrees([
  { lat: 53, lng: -2.4 },
  { lat: 53.001, lng: -2.4 }
], routeForNavigation, 1)), 0, "recent northward movement should point the runner arrow north");

const navigationCss = source("src/runningNavigation.css");
const routePreviewSource = source("src/runningRoutePreviewRuntime.ts");
const streetMapSource = source("src/runningStreetMap.ts");
assert.match(navigationCss, /min-height:\s*clamp\(230px,\s*36dvh,\s*380px\)/, "the live route map must be a readable panel, not a thumbnail");
assert.match(navigationCss, /data-appearance="dark"|background:\s*rgba\(9, 15, 31/, "dark Running navigation needs an explicit dark surface");
assert.doesNotMatch(navigationCss, /html:not\(\.dark\) \.running-navigation-dock/, "appearance-dark must not accidentally receive the light navigation card");
assert.match(routePreviewSource, /class="running-runner-marker"[\s\S]*data-heading=/, "the map needs a visible heading-aware runner marker");
assert.match(streetMapSource, /tiles\.openfreemap\.org\/styles\/dark/, "the live map should use OpenFreeMap's dark street style");
assert.match(streetMapSource, /OpenStreetMap contributors/, "the online street map must carry required attribution");
assert.match(streetMapSource, /zenchad-route-remaining[\s\S]*#f2c94c/, "remaining street-map geometry must stay gold");
assert.match(streetMapSource, /zenchad-route-completed[\s\S]*#2f9cff/, "completed street-map geometry must stay blue");
assert.match(routePreviewSource, /running-navigation-mini-map/, "the schematic map must remain as an automatic fallback");
assert.match(source("src/runningRouteRuntime.ts"), /namespaceRouteManeuvers[\s\S]*`r\$\{revision\}:`/, "reroutes must namespace maneuver IDs by route revision");

// Streaks are bonus-only and do not erase the historical best after a gap.
let streak = { currentDays: 0, bestDays: 0, lastRunDay: null };
streak = progression.updateRunningStreak(streak, new Date("2026-08-01T12:00:00Z").getTime());
streak = progression.updateRunningStreak(streak, new Date("2026-08-02T12:00:00Z").getTime());
streak = progression.updateRunningStreak(streak, new Date("2026-08-03T12:00:00Z").getTime());
assert.equal(streak.currentDays, 3);
assert.equal(streak.bestDays, 3);
streak = progression.updateRunningStreak(streak, new Date("2026-08-06T12:00:00Z").getTime());
assert.equal(streak.currentDays, 1);
assert.equal(streak.bestDays, 3);
assert.equal(progression.runningStreakMultiplier(1), 1);
assert.equal(progression.runningStreakMultiplier(100), 1.5);

function runPoints(startAt) {
  return Array.from({ length: 14 }, (_, index) => ({
    lat: 53 + index * 0.00045,
    lng: -2.4,
    accuracy: 5,
    at: startAt + index * 30_000,
    distanceFromStart: index * 100
  }));
}

const baseState = {
  version: 1,
  processedRunIds: [],
  streak: { currentDays: 0, bestDays: 0, lastRunDay: null },
  achievements: [],
  sectors: []
};
const runOne = {
  id: "run-1",
  mode: "quick",
  endedAt: new Date("2026-08-01T12:30:00Z").getTime(),
  distanceMeters: 1300,
  completionRatio: 1,
  personalBestKeys: [],
  points: runPoints(new Date("2026-08-01T12:00:00Z").getTime())
};
const runTwo = {
  ...runOne,
  id: "run-2",
  endedAt: new Date("2026-08-02T12:30:00Z").getTime(),
  points: runPoints(new Date("2026-08-02T12:00:00Z").getTime())
};
let progressState = progression.processRunningRecord(baseState, runOne, [runOne]);
assert.equal(progressState.sectors.some((sector) => sector.discovered), false);
progressState = progression.processRunningRecord(progressState, runTwo, [runOne, runTwo]);
assert.equal(progressState.sectors.some((sector) => sector.discovered), true, "repeated real-world stretches should become Runner Sectors");

// Integration wiring: lock down easy-to-regress pieces that CI can prove without a phone.
const valhallaSource = source("src/runningValhalla.ts");
assert.match(
  valhallaSource,
  /const DEFAULT_BASE_URL = ["']https:\/\/valhalla1\.openstreetmap\.de["']/, 
  "Running must point at the Valhalla API host rather than the demo web-app host"
);
assert.match(valhallaSource, /X-Client-Id/, "public Valhalla requests should identify Zenchad");
assert.match(valhallaSource, /PUBLIC_DEMO_REQUEST_INTERVAL_MS\s*=\s*1100/, "public demo candidate requests should be paced");
assert.doesNotMatch(valhallaSource, /Promise\.all\s*\([^)]*fetchCandidate/s, "public route candidates must not be burst-requested in parallel");

const mainSource = source("src/main.tsx");
for (const runtimeStart of [
  "startRunningNativeGeolocationBridge()",
  "startRunningFinishGuardRuntime()",
  "startRunningRouteRuntime()",
  "startRunningRouteFallbackRuntime()",
  "startRunningRoutePreviewRuntime()",
  "startRunningCampaignRuntime()",
  "startRunningStoryResultsRuntime()",
  "startRunningStoryMapMarkersRuntime()",
  "startRunningProgressionRuntime()",
  "startRunningRewardBonusRuntime()",
  "startRunningElevationRuntime()",
  "startRunningHistoryEnrichmentRuntime()",
  "startRunningHealthRuntime()",
  "startRunningDiagnosticsRuntime()"
]) {
  assert.ok(mainSource.includes(runtimeStart), `${runtimeStart} must stay active in the app bootstrap`);
}

const finishGuardSource = source("src/runningFinishGuardRuntime.ts");
assert.ok(finishGuardSource.includes("stopNativeRunningTracker()"), "END RUN must stop and snapshot the native tracker before banking");
assert.match(finishGuardSource, /Promise\.race\([\s\S]*FINAL_GPS_TIMEOUT_MS/, "a hung native GPS stop must have a bounded finish deadline");
assert.ok(finishGuardSource.includes("snapshot.sessionId !== current.id"), "final native GPS must never be attached to a different run session");
assert.ok(finishGuardSource.includes("BANKING FINAL GPS"), "END RUN should visibly prevent duplicate payout taps while native points are being banked");
assert.match(runningScreenSource, /GPS on\. Directions off\./, "Just Run must clearly distinguish GPS tracking from guidance");
assert.match(source("src/runningRouteRuntime.ts"), /session\.mode === "just"[\s\S]*clearNativeRouteOnce\(\)[\s\S]*removeNavigationDock\(\)/, "Just Run must disable navigation without disabling run tracking");

const appSource = source("src/App.tsx");
assert.ok(appSource.includes("pendingRunningRewardBonuses()"), "global app state must consume queued Running streak bonuses");
assert.ok(appSource.includes("addRunningXp(current.stats, total)"), "Running streak bonus must feed global XP");
assert.ok(appSource.includes("markRunningRewardBonusesApplied"), "Running streak bonuses need replay protection");
assert.match(source("src/storage.ts"), /level: levelForXp\(migratedXp\)/, "saved levels must be recalculated after an XP-curve migration");

const diagnosticsSource = source("src/runningDiagnostics.ts");
assert.ok(diagnosticsSource.includes("exact GPS coordinates and route geometry are intentionally omitted"), "copied diagnostics must carry the privacy guarantee");
assert.doesNotMatch(diagnosticsSource, /`[^`]*(?:lat|lng)=\$\{/i, "diagnostics text must not interpolate raw latitude/longitude");

console.log("Running logic tests passed.");
