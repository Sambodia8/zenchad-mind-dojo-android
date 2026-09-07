import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");

const manifest = source("android/app/src/main/AndroidManifest.xml");
assert.ok(manifest.includes("android.permission.POST_NOTIFICATIONS"), "running must declare Android notification permission for its foreground-service card");
assert.ok(manifest.includes("android.permission.health.READ_HEART_RATE"), "Health Connect heart-rate permission must stay declared");
assert.ok(manifest.includes("android.permission.health.READ_STEPS"), "Health Connect step/cadence permission must stay declared");
assert.ok(manifest.includes("android.intent.action.VIEW_PERMISSION_USAGE"), "Health Connect must expose a permission-usage rationale destination");
assert.ok(manifest.includes("android.intent.category.HEALTH_PERMISSIONS"), "Health Connect rationale activity needs the health-permissions category");
assert.ok(manifest.includes("android.permission.START_VIEW_PERMISSION_USAGE"), "Health Connect rationale activity should only be launched by the permission system");
assert.ok(manifest.includes("HealthPermissionsRationaleActivity"), "Health Connect rationale activity must stay registered");

const healthPlugin = source("android/app/src/main/java/com/zenchad/minddojo/RunningHealthPlugin.java");
assert.ok(healthPlugin.includes("aggregateLong("), "post-run steps should use Health Connect aggregation");
assert.ok(healthPlugin.includes('"STEPS_COUNT_TOTAL"'), "post-run step aggregation must use StepsRecord.STEPS_COUNT_TOTAL");
assert.ok(healthPlugin.includes('awaitHealthCall(request, "aggregate")'), "step totals must be obtained from HealthConnectManager.aggregate");
assert.ok(!healthPlugin.includes("List<?> stepRecords = readRecords"), "raw step records must not be manually summed across overlapping data sources");

const rationale = source("android/app/src/main/java/com/zenchad/minddojo/HealthPermissionsRationaleActivity.java");
assert.match(rationale, /Health Connect is optional/i);
assert.match(rationale, /local app storage/i);
assert.match(rationale, /not required to track a run|never required to track a run/i);

const trackerService = source("android/app/src/main/java/com/zenchad/minddojo/RunningTrackerService.java");
assert.ok(trackerService.includes("if (reset) resetNativeDirectors();"), "a new run session must tear down any old native navigation/story audio first");
assert.ok(trackerService.includes("shutdownNativeDirectors();\n        createNativeDirectors();"), "session reset must recreate fresh native directors after shutdown");
assert.ok(trackerService.includes('point.put("heading", (double) location.getBearing())'), "native GPS bearing must reach the on-map runner arrow");

const runningScreen = source("src/screens/RunningModeScreen.tsx");
assert.match(
  runningScreen,
  /const startActualRun = async \(\) => \{[\s\S]*?if \(isNativeAndroid\(\)\) \{[\s\S]*?startNativeRunningTracker\(current\.id, true\)[\s\S]*?\}[\s\S]*?distanceMeters: 0,[\s\S]*?points: \[\]/,
  "warm-up to active must reset native points before the measured run starts"
);
assert.ok(
  runningScreen.includes("await startNativeRunningTracker(current.id, true).catch(() => {})"),
  "native warm-up reset must remain best-effort so Android tracking failure does not block starting a run"
);

const navigator = source("android/app/src/main/java/com/zenchad/minddojo/RunningBackgroundNavigator.java");
assert.ok(
  navigator.includes("if (speak(next.verbalAlert.isEmpty() ? next.instruction : next.verbalAlert)) {\n                markSpoken(nowKey);"),
  "turn-now cues should be marked delivered only after TTS accepts them"
);
assert.ok(
  navigator.includes("if (speak(next.verbalInstruction.isEmpty() ? next.instruction : next.verbalInstruction)) {\n                markSpoken(previewKey);"),
  "preview cues should be marked delivered only after TTS accepts them"
);
assert.match(navigator, /private boolean speak\(String text\)/, "background navigation speech must report whether the cue was accepted");
assert.ok(navigator.includes(".setOnAudioFocusChangeListener(audioFocusChangeListener)"), "Android navigation audio focus must supply a listener when it requests duck/pause behaviour");

const storySfxController = source("android/app/src/main/java/com/zenchad/minddojo/RunningStorySfxController.java");
assert.ok(!storySfxController.includes("RunningStoryEventLog.reset(context, sessionId)"), "Android process restart must not erase earlier Story event markers for the same run");
assert.ok(storySfxController.includes("chaseWasActive = prefs.getBoolean(RunningBackgroundStoryDirector.KEY_ACTIVE_CHASE, false);"), "Story SFX state should reconstruct an active chase after process restart instead of logging a duplicate chase start");
assert.ok(storySfxController.includes('helicopterWasActive = "helicopter".equals(prefs.getString(RunningBackgroundStoryDirector.KEY_PHASE, ""));'), "Story SFX state should reconstruct an active helicopter set-piece after process restart");
assert.ok(storySfxController.includes("previousSfxEnabled = false;"), "restored helicopter audio should be allowed to resume without creating a duplicate event marker");

const storyVoice = source("android/app/src/main/java/com/zenchad/minddojo/RunningStoryVoiceEngine.java");
const storyDirector = source("android/app/src/main/java/com/zenchad/minddojo/RunningBackgroundStoryDirector.java");
const storyPlugin = source("android/app/src/main/java/com/zenchad/minddojo/RunningStoryDirectorPlugin.java");
const storyRuntime = source("src/runningNativeStoryRuntime.ts");
const storyLiveUi = source("src/runningStoryLiveUi.ts");
assert.match(storyVoice, /AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK/, "recorded Story narration must request transient audio focus");
assert.match(storyVoice, /USAGE_ASSISTANCE_NAVIGATION_GUIDANCE/, "Story narration must use the audible guidance channel");
assert.match(storyVoice, /PlaybackListener/, "recorded Story narration must report real playback lifecycle events");
assert.match(storyDirector, /onError\(String reason\)[\s\S]*speakWithTextToSpeech\(text\)/, "a recorded narration failure must fall back to Android TTS");
assert.match(storyDirector, /setAudioState\("playing"/, "Story state must reflect narration only after playback starts");
assert.match(storyDirector, /setAudioState\("failed"/, "Story playback failures must be persisted for the UI");
assert.match(storyPlugin, /audioState/, "the Story bridge must expose native playback state");
assert.match(storyDirector, /onCompleted\(\)[\s\S]*markLineHeard\(activeLineKey\)/, "recorded Story chapters must be marked heard only after playback completes");
assert.match(storyDirector, /onDone\(String utteranceId\)[\s\S]*markLineHeard\(activeLineKey\)/, "TTS Story chapters must be marked heard only after speech completes");
assert.match(storyPlugin, /replayLast/, "the native Story bridge must expose a real replay control");
assert.match(storyRuntime, /renderStoryLivePanel/, "native playback state must feed the live Story panel");
assert.match(storyLiveUi, /Runner Story active · Episode/, "the Story UI must clearly label the active episode");
assert.match(storyLiveUi, /Audio failed/, "silent Story failures must be visible to the runner");
assert.match(storyLiveUi, /Replay last transmission/, "the runner needs a real replay control after a missed transmission");

const workflow = source(".github/workflows/build.yml");
assert.match(workflow, /cancel-in-progress:\s*true/, "superseded Running build checks should be cancelled instead of queueing stale commits");

console.log("Running native integration tests passed.");
