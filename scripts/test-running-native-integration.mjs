import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const manifest = source("android/app/src/main/AndroidManifest.xml");
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

const storySfxController = source("android/app/src/main/java/com/zenchad/minddojo/RunningStorySfxController.java");
assert.ok(!storySfxController.includes("RunningStoryEventLog.reset(context, sessionId)"), "Android process restart must not erase earlier Story event markers for the same run");
assert.ok(storySfxController.includes("chaseWasActive = prefs.getBoolean(RunningBackgroundStoryDirector.KEY_ACTIVE_CHASE, false);"), "Story SFX state should reconstruct an active chase after process restart instead of logging a duplicate chase start");
assert.ok(storySfxController.includes('helicopterWasActive = "helicopter".equals(prefs.getString(RunningBackgroundStoryDirector.KEY_PHASE, ""));'), "Story SFX state should reconstruct an active helicopter set-piece after process restart");
assert.ok(storySfxController.includes("previousSfxEnabled = false;"), "restored helicopter audio should be allowed to resume without creating a duplicate event marker");

const workflow = source(".github/workflows/build.yml");
assert.match(workflow, /cancel-in-progress:\s*true/, "superseded Running build checks should be cancelled instead of queueing stale commits");

console.log("Running native integration tests passed.");
