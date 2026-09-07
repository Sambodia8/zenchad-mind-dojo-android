import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

const speech = source("src/runningSpeech.ts");
assert.match(speech, /preferredRunningSpeechVoice/, "running speech must choose a preferred installed voice when available");
assert.match(speech, /voice\.networkRequired.*score -= 2_000/, "automatic voice selection must strongly prefer offline voices");
assert.match(speech, /startsWith\("en-gb"\)/, "automatic voice selection must prefer installed British English");
assert.match(speech, /voiceschanged/, "WebView voices loaded asynchronously must refresh the selector");
assert.match(speech, /voicesReady/, "Android must publish deterministic TTS readiness instead of relying on a one-shot timer");
assert.match(speech, /selectedVoiceId \? \{ voiceId: selectedVoiceId \}/, "a persisted voice must be passed to Android navigation speech");
assert.match(speech, /speechSynthesis\.cancel\(\)/, "stopping navigation speech must still cancel WebView speech");

const settings = source("src/components/RunningVoiceSettings.tsx");
const runningHub = source("src/screens/RunningModeScreen.tsx");
assert.match(settings, /Running voice/, "Settings must expose a running voice selector");
assert.match(settings, /Play running navigation voice sample/, "Settings must expose an accessible voice sample control");
assert.match(settings, /Internet required/, "online Android voices must be marked explicitly");
assert.match(runningHub, /<RunningVoiceSettings[^>]*compact/, "Running Hub must expose the current voice and sample control directly");

const storage = source("src/storage.ts");
assert.match(storage, /runningSpeechVoiceId: null/, "new installs must safely use automatic voice selection");
assert.match(storage, /typeof saved\.runningSpeechVoiceId === "string"/, "invalid persisted voice IDs must fall back safely");

const native = source("android/app/src/main/java/com/zenchad/minddojo/RunningSpeechPlugin.java");
assert.match(native, /public void getVoices/, "Android must expose installed TTS voices to the selector");
assert.match(native, /INITIALISATION_TIMEOUT_MS/, "Android readiness must have a bounded timeout");
assert.match(native, /retryOrReject/, "failed speech must receive one bounded local/system fallback attempt");
assert.match(native, /public void stop\(PluginCall call\)/, "Android speech stop support must remain available");

const policy = source("android/app/src/main/java/com/zenchad/minddojo/RunningVoicePolicy.java");
const background = source("android/app/src/main/java/com/zenchad/minddojo/RunningBackgroundNavigator.java");
assert.match(policy, /KEY_FEATURE_NOT_INSTALLED/, "automatic selection must exclude voices that are not installed");
assert.match(policy, /isNetworkConnectionRequired/, "native foreground and background speech must share offline-first metadata");
assert.match(background, /RunningVoicePolicy\.selectedVoice\(context\)/, "screen-off navigation must use the same persisted voice selection");

console.log("Running TTS voice selection tests passed.");
