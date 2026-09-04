# Release process

1. Run the focused progression and Running checks, then `npm run build`.
2. Run `npx cap sync android` from the project root.
3. Bump `versionCode` and `versionName` in `android/app/build.gradle`.
4. Build with the bundled JDK 21: `android\gradlew.bat assembleDebug --no-daemon`.
5. Verify package/version metadata, APK signature, and SHA-256.
6. Copy one numbered APK to `D:\My Drive\ZenChad` and retain older Drive releases.
7. Update `RELEASE_NOTES.md` and `codexdiary.log`, then commit and push the source changes.
