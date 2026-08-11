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
