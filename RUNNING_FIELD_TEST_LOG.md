# Running field-test record

## 2026-08-10 - Pixel 6a baseline

- Source: GitHub `main` at `70421b3619280599d03650fd05ebee7fa927c0b9`.
- Device: physical Google Pixel 6a, Android 17 / API 37, connected and authorised over ADB.
- Passed locally: clean dependency install, appearance tests, Running logic tests, Running native integration tests, TypeScript/Vite production build, Capacitor Android sync, and Android debug compilation with Java 21.
- Installed: isolated `com.zenchad.minddojo.fieldtest` build, version `1.4-fieldtest` / code 5. The existing `com.zenchad.minddojo` version 1.5 / code 6 and its data were preserved.
- Physically verified on phone: app launch and render; Toolkit to Running Hub navigation; Quick Run and Story Run cards render; 20/30/45/60-minute Quick Run choices render; choosing 20 minutes requests Android location access; precise foreground location can be granted successfully.
- Not yet physically verified: generated route/preview, prep sequence and XP, active GPS run, notification, screen-off/background tracking, final native GPS banking, summary/history, navigation timing, off-route recovery, external music/audio focus, Story movement/chases, process recovery, route-service failure, Health Connect, and diagnostics privacy output.
- Device-session note: the phone switched to another foreground app before route generation could be confirmed, so no route or outdoor behavior is recorded as passed.
- Bug found and fixed: the native integration regression test assumed Unix line endings and failed on Windows even though the Java lifecycle implementation was correct. Test source is now normalized before multi-line assertions.
- Local setup issue resolved without source changes: Gradle initially used Java 17 from `JAVA_HOME`; the Android build passed when run with the installed Microsoft Java 21 runtime.

## 2026-08-20–21 - Running Mode completion, Pixel 6a indoor QA

- Build/install: built the current dirty working tree with Java 21 and installed `com.zenchad.minddojo` 1.7/code 8 in replacement mode. The debug signing certificate matched, both requested installs preserved app data, and the final install timestamp was confirmed on-device.
- Automated verification passed after the final changes: Running logic and native-integration tests, run-photo source tests, TTS source tests, TypeScript checking, production Vite build, Capacitor Android sync, and Java 21 debug APK assembly.
- Run-photo permissions verified on the phone: prompt, denied, Android selected/limited access, and full access. Limited access displayed “Selected photos only,” exposed Manage access, and did not claim new camera photos were watched.
- Run-photo lifecycle verified: a controlled Camera photo was imported immediately after returning to ZenChad, received the nearest recorded GPS point by capture time, retained its private thumbnail after the original test photo was deleted, displayed a friendly capture-time label instead of its camera filename, accepted the caption “Blue QA photo,” moved atomically to a temporary run association and back without metadata loss, and was finally removed from the run. Removal deleted ZenChad's private thumbnail/association only.
- Voice verified on the phone: Running Hub exposes the current friendly voice and reusable selector/sample control; installed/offline/online metadata rendered; an offline `en-GB` voice spoke a sample; Automatic selection persisted across relaunch. Source/native tests cover readiness queueing and bounded local/default fallback. Airplane-mode speech-error fallback and screen-off navigation speech were not physically exercised in this indoor session.
- Map verified on the phone: OpenFreeMap's dark street map rendered road context, labels, scale and attribution with the contrasting gold route, blue progress route, and heading marker. The WebView CSP-worker startup fault found during QA was repaired. The saved offline trace showed north, scale, start/finish, geographic aspect, and direction chevrons. A genuine network/tile/WebGL failure was not forced on-device; the schematic fallback remains covered by implementation/source checks.
- Lifecycle verified indoors: preparation, stretch handoff, warm-up, active tracking, Camera pause/resume, preserve-data reinstall/resume, confirmed early finish, summary, name edit, history, and relaunch. The zero-distance stationary run was saved as “Indoor QA Run”; it is lifecycle evidence only and intentionally does not validate distance, moving pace, splits, best efforts, or outdoor reward proportionality.
- Post-run/accessibility QA: the final summary, trace, photo editor, history details, and optional watch-stat card use the shared dark palette and system typography; key Running controls have 44 px minimum targets and explicit labels/status regions in source. Full TalkBack traversal, Android accessibility-tree verification inside the WebView, and a live active-run 360×700 device viewport remain unverified.

### Deferred Sandbach outdoor route - unverified checklist

- [ ] Start near Sandbach railway station/Elworth and use the B5079 Station Road corridor toward London Road, incorporating safe left and right maneuvers through nearby School Lane/Moss Lane only where the generated pedestrian route permits.
- [ ] Record Valhalla's exact maneuver before each junction and compare its left/right direction with the physical road. Treat provider text/type as authoritative; do not infer or reverse it from geometry.
- [ ] Verify preview and turn speech near the configured 135 m and 38 m approach thresholds, including credible distance and ETA wording.
- [ ] Safely deviate once, wait for rerouting, and confirm the route-revision maneuver IDs prevent repeated, suppressed, reversed, or stale instructions.
- [ ] Capture a photo while Camera suspends ZenChad, then confirm immediate resume import and nearest-by-capture-time GPS matching outdoors.
- [ ] Validate real distance, teleport/noise rejection, recent 30-second pace, elapsed/moving time, kilometre splits, personal bests, warm-up exclusion, normal finish, and reward proportionality using a controlled real track.
- [ ] Exercise screen-off/background voice selection and airplane-mode selected-voice failure fallback.
- [ ] Complete TalkBack/focus-order checks and a live 360×700 active-run layout check.

No item in this deferred checklist has been performed or passed.
