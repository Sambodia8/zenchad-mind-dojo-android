# Release process

1. Run the focused progression and Running checks, then `npm run build`.
2. Run `npx cap sync android` from the project root.
3. Bump `versionCode` and `versionName` in `android/app/build.gradle`.
4. Build with the bundled JDK 21: `android\gradlew.bat assembleDebug --no-daemon`.
5. Verify package/version metadata, APK signature, and SHA-256.
6. Name the APK `NeuralFantasy-<version>-<description>.apk`. Copy the identical numbered file to `releases/` and `D:\My Drive\ZenChad`, verify matching hashes and cloud delivery, and retain older releases. The existing Drive folder name is a compatibility location.
7. Update `RELEASE_NOTES.md` and `codexdiary.log`, then commit and push the source changes.
