# Zen Chad 2.1 — Pre-run whole-body mobility (2026-09-09)

- Replaced Before Running with a 14-slide, 6:20 whole-body mobility warm-up moving through ankles, hips, spine, legs, calves, shoulders, hamstrings, and back.
- Added 36 transparent, aligned Mark keyframes with 700 ms active-movement playback, pause/resume continuity, still-image transitions and fallbacks, side mirroring, and reduced-motion support.
- Preserved Before Cycling while moving its warm-up records into canonical data, and kept runner/cycling-only movements out of Full House.
- Version code 12; version name 2.1; shareable debug APK for side-loading and in-place updates.
- Artifact: `Zen-Chad-2.1-Pre-Run-Mobility.apk`, 474,703,504 bytes.
- SHA-256: `25E841A0EA18A8202B6FF0B83547FDDD9527C374ACC065F7E5EC362D4ED1B731`.
- Verified with focused Yoga checks, TypeScript/Vite production build, Capacitor Android sync, JDK 21 debug assembly, package/version metadata, APK v1/v2 signatures, exact packaged Mark-frame count, exclusion of the review contact sheet, and matching local/Drive hashes.
- Release copies: `S:\zENcHAD\ZenChadAndroid\releases\Zen-Chad-2.1-Pre-Run-Mobility.apk` and `D:\My Drive\ZenChad\Zen-Chad-2.1-Pre-Run-Mobility.apk`.
- No live Android device or emulator test was available for this packaging pass.

# Zen Chad Next Generation — current full rebuild (2026-09-07)

- Rebuilt the complete current Android working tree, including the latest Home/Status experience, ZenPoints and shop rewards, Streak Freeze support, sync work, Yoga updates, and expanded Running Mode photo, voice, story, navigation, and native integration changes.
- Preserved the existing `com.zenchad.minddojo` application identity so this APK can update the installed app without resetting its data.
- Version code 11; version name 2.0; shareable debug APK for side-loading.
- Artifact: `Zen Chad Next Generation.apk`, 467,547,411 bytes.
- SHA-256: `795A1E2D690D4EF26549AE3D7EF2DA34158C95B379BBB11B7F193594C942BF05`.
- Verified with sync, progression, Yoga, theme, ZenPoints, shop, Streak Freeze, Running logic/native integration, Running TTS and photo tests; TypeScript/Vite production build; Capacitor sync; JDK 21 debug assembly; package/version metadata; APK v1/v2 signature verification; and matching source/release/Drive-copy hashes.
- Release copies: `S:\zENcHAD\ZenChadAndroid\releases\Zen Chad Next Generation.apk` and `D:\My Drive\ZenChad\Zen Chad Next Generation.apk`.
- No device installation or physical phone test was run for this packaging pass.

# Zen Chad 1.9 — Clean paper-doll character and cosmetic wardrobe (2026-09-03)

- Rebuilt the Status character base from scratch to remove accumulated image-to-image faceting and noise.
- Added a longer original pink side-swept hairstyle matching the canonical ZenChad appearance, while keeping Hair as its own category.
- Refitted the Porter Robinson Nurture, Noodle DARE, silver-lilac, Hana Candy Bracelets, and Cream Meditation Jacket cosmetics to the clean 1024×1536 paper-doll base.
- Preserved existing cosmetic IDs, starter ownership, shop prices, saved equipment, and legacy `head` → `hair` migration.
- Version code 10; shareable debug APK for side-loading.
- Artifact: `Zen-Chad-1.9-debug.apk`, 461,363,116 bytes.
- SHA-256: `D767CEF7280CC73777781DF4F3E3830C4AF0DBE9A695D7A49D55955CF7FCFC0B`.
- Verified with progression, shop, Running/native integration, TypeScript/Vite build, Capacitor sync, JDK 21 debug assembly, package/version metadata, APK v1/v2 signature verification, and matching local/Drive-copy hashes.
- Release copies: `S:\zENcHAD\ZenChadAndroid\releases\Zen-Chad-1.9-debug.apk` and `D:\My Drive\ZenChad\Zen-Chad-1.9-debug.apk`.

# Zen Chad 1.8 — Running, recovery prompts, and Yoga with Mark fixes (2026-08-31)

- Added a Just Run choice screen so people can start a quiet route-free run immediately or opt into the Before Running stretches first; finishing that warm-up goes directly into Just Run.
- Removed the automatic NSDR and meditation-wheel upsell from yoga/stretch completion screens while preserving intentional NSDR access through the meditation library and relevant Bike Quest return paths.
- Replaced the Side Lunge pose illustration with a Mark-matched standing lateral-lunge asset based on the approved reference illustrations.
- Version code 9; shareable debug APK for side-loading.
- Artifact: `Zen-Chad-1.8-debug.apk`, 369,072,661 bytes.
- SHA-256: `E37EABE3004F56D79E241E750BEA444F2529DA4A8A35E08CA7EFED28CFD84082`.
- Verified with progression, Yoga, Running/native integration, TypeScript/Vite build, Capacitor sync, Java 21 debug assembly, package/version metadata, APK signature verification, and matching local/Drive-copy hashes.
- Release copies: `S:\zENcHAD\ZenChadAndroid\releases\Zen-Chad-1.8-debug.apk` and `D:\My Drive\ZenChad\Zen-Chad-1.8-debug.apk`.

# Zen Chad 1.7 — Running Mode completion (2026-08-21)

- Completed the Android Running Mode photo workflow: Android limited-access handling, always-reachable permission controls, immediate resume refresh, capture-time GPS matching, friendly captions, atomic run reassignment, and clearly separated association/thumbnail removal.
- Added an offline-first Running voice card and selector with friendly voice metadata, TTS readiness handling, shared foreground/background selection policy, and bounded local/system-default speech fallback.
- Added a dark OpenFreeMap/MapLibre street map with an automatic schematic fallback, contrasting completed/remaining routes, heading marker, scale/north/attribution, reroute-revision maneuver IDs, and clearer saved-route traces.
- Added actual-travel fallback names, editable run names, completed-only history behavior, broader deterministic metric/reward fixtures, and dark accessible post-run/history styling.
- Built with Java 21 and installed on the Pixel 6a using replacement mode so existing app data remained intact. Installable artifact: `Zen-Chad-1.7-Running-Mode-debug.apk`, 368,538,911 bytes; SHA-256 `3CB56AD5CC10304D09330CA74B915237FC7986AA0A598F5001A736BCE6AA464A`.
- Verified matching copies: `releases/Zen-Chad-1.7-Running-Mode-debug.apk` and `D:\My Drive\ZenChad\Zen-Chad-1.7-Running-Mode-debug.apk`.
- Verified Running/native, photo and TTS tests; TypeScript and production web build; Capacitor sync; Java 21 debug assembly; package/version/signature; and the documented indoor phone flows. The Sandbach Station Road outdoor navigation/real-track checklist remains explicitly unverified in `RUNNING_FIELD_TEST_LOG.md`.

# Zen Chad 1.7 — Yoga with Mark visual redesign (2026-08-19)

- Rebuilt the Yoga flow around the selected cosmic-dark visual direction with a larger Mark hero, four new class-cover families, image-first class cards, richer class details, an immersive class player, and a two-column routine builder.
- Preserved the main Home character, the existing 45 pose illustrations, Yoga class data, and user storage.
- Version code 8; shareable debug APK for side-loading.
- Artifact: `Zen-Chad-1.7-debug.apk`, 350,390,970 bytes.
- SHA-256: `1E281EAC5BDB7DC1B728750B8C46A40ADCEFA260884BF92631B2C5C2B9D96C7B`.
- Verified with TypeScript/Vite build, Capacitor sync, JDK 21 debug APK assembly, package/version metadata, APK signature verification, theme tests, and matching source/Drive-copy hashes.
- Drive copy: `D:\My Drive\ZenChad\Zen-Chad-1.7-debug.apk` in the [ZenChad Google Drive folder](https://drive.google.com/drive/folders/1qAXaw1awLpyj96aIiu3c-E6FhybA0Vw0).

# Zen Chad 1.5 — current rebuild (2026-08-10)

- Pulled the latest `main` from GitHub at commit `ab285cd`, including automatic run route scoring.
- Version code 6; shareable debug APK for side-loading.
- Artifact: `Zen-Chad-1.5-debug.apk`, 300,515,475 bytes.
- SHA-256: `412A8837C7016D4C448082EA1463D70C812ADFE365E045558AD8868A255A80E1`.
- Verified with TypeScript/Vite build, Capacitor sync, Android lint, JDK 21 debug APK assembly, package/version inspection, signature validation, and packaged-asset/native-library inspection.
- Drive copy: `D:\My Drive\ZenChad\Zen-Chad-1.5-debug.apk`.

# Zen Chad 1.4 — current rebuild (2026-08-04)

- Rebuilt the current Capacitor Android app from the latest workspace bundle, including the current Yoga library, pose assets, and offline AI journaling additions.
- Version code 5; shareable debug APK for side-loading.
- Artifact: `Zen-Chad-1.4-debug.apk`, 298,387,915 bytes.
- SHA-256: `99FD966FF332F6D0A137CB64AFF534BB3FDACCB7F083592765361D183597D8FD`.
- Verified with TypeScript/Vite build, Android lint, APK package/version inspection, and packaged-asset inspection (47 stretch/pose assets, 147 audio assets, and the native Qwen library).
- Drive copy: `D:\My Drive\ZenChad\Zen-Chad-1.4-debug.apk`.

# Zen Chad 1.3

- Rebuilt the complete current shared workspace rather than reusing the earlier web bundle.
- Includes the updated homepage recommendations and fast routes, the expanded Yoga with Mark
  classes and safety flow, and the adaptive emotional toolbox with outcome tracking.
- Includes 52 offline guided meditation narrations across thirteen practices.
- Includes two offline meditation-music beds for every guided practice, with independent persisted
  voice/music controls and non-repeating music rotation.
- Version code 4; shareable debug APK for side-loading.
- Artifact: `Zen-Chad-1.3-debug.apk`, 260,573,625 bytes.
- SHA-256: `F6DD79EACD237161DFEB4B3CF541F69A71EB63126D993AC853A888212CEE7E55`.
- Verified with Android lint, APK signature validation, version inspection, packaged feature-string
  inspection, and exact in-APK counts of 52 narration and 26 meditation-music tracks.

# Zen Chad 1.2

- Rebuilt the current Android app bundle for sharing.
- Version code 3; debug APK artifact uploaded to Google Drive.

# Zen Chad 1.1

- Reart-directed the complete app around the warm watercolour "Vision 2" visual language.
- Added five-destination navigation plus Live Zen Guide, offline soundscapes, weekly quests,
  illustrated badges, unlockable themes, and calm settings surfaces.
- Preserved the existing timers, reminders, journal, mood check-ins, emotional toolbox,
  voice-assisted stretch flow, progress tracking, and offline storage.
- Added a new Zen Chad mascot, adaptive launcher art, splash art, dark system bars, responsive
  layouts, accessible control sizes, content descriptions, and reduced-motion support.

# Zen Chad 1.6 — status, Running Mode, and Bike Quest update (2026-08-12)

- Consolidated the JRPG-style Status screen refresh, Running Mode lifecycle/notification fixes and story voice/SFX support, and the current Bike Quest/progression updates.
- Version code 7; shareable debug APK for side-loading.
- Artifact: `Zen-Chad-1.6-debug.apk`, 344,059,225 bytes.
- SHA-256: `C04532F76EFD40044A92B1D9B900F9F89CFBD24E19FCF4ACD4F66895208DD5E9`.
- Verified with progression checks, Running logic checks, native Running integration checks, TypeScript/Vite build, Capacitor sync, JDK 21 debug APK assembly, package/version inspection, and APK signature validation.
- Drive copy: `D:\My Drive\ZenChad\Zen-Chad-1.6-debug.apk` in the [ZenChad Google Drive folder](https://drive.google.com/drive/folders/1qAXaw1awLpyj96aIiu3c-E6FhybA0Vw0).
