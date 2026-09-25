# Zen Chad 2.15 — Zen Coach (2026-09-25)

- Added a daily run or Bike Quest recommendation with three alternatives, rest and snooze, a rolling three-session goal, and a short feedback loop based on real completed sessions.
- Carried accepted plans into Running Mode or Bike Quest. Running adds a compact Hype List, optional Circuit style, contextual Yuna/daylight prompts, rescue choices, and a quick debrief.
- Added an opt-in Atlas of privacy-trimmed completed GPS routes and optional local reminders with quiet hours. No live weather/calendar source or unverified route is presented as available.
- Version code 26; version name 2.15; shareable debug APK: `ZenChad-2.15-Zen-Coach.apk`.
- SHA-256: `178430C68F10CCC8A702386D7CA14A726790FE10357155DC6561E9AA3A0AC914`.
- Verified Zen Coach and Running tests, TypeScript/Vite production build, Capacitor Android sync, Gradle assembly, package/version metadata, APK v1/v2 signature, and 412 × 915 browser flows. Native notifications and GPS still need device verification.
- Release copies: `S:\zENcHAD\ZenChadAndroid\releases\ZenChad-2.15-Zen-Coach.apk` and `D:\My Drive\ZenChad\ZenChad-2.15-Zen-Coach.apk`; both match the source SHA-256.

# Zen Chad 2.7 — Run Quest warm-up art fix (2026-09-22)

- Replaced only the inaccurate Before Running artwork: source-accurate ankle inversion/eversion, hip flexion and opener, hip flexion with torso rotation, small shoulder-height arm circles in two palm-direction phases, calf stretch and heel raises, and the shared longer-haired Yoga Mark Forward Fold.
- Added the source-accurate `ankle-inversion-eversion` movement for Before Running while retaining the existing `ankle-circles` movement for Before Cycling; revised labels and cues to match the supplied Yoga With Tim transcript.
- Stored rollback-safe movement frames under `public/assets/stretches/generated/pre-run-v3/`, kept the new Forward Fold as `forward-fold-v2.png`, and kept prompts/contact sheets under `design-reference/pre-run-v3/` outside the packaged public bundle.
- Preserved 700 ms playback, pause/resume, reduced-motion behavior, class duration, rewards, Run Quest handoff, all unaffected movement frames, and existing Yoga/Before Cycling content.
- Version code 18; version name 2.7; shareable debug APK for in-place updates.
- Artifact: `ZenChad-2.7-Run-Warmup-Art-Fix.apk`, 395,879,900 bytes.
- SHA-256: `19D5C265A0D16DCC37054B8F51DAD1B961FCD207B04EBA4E07CBBC638CB822EB`.
- Verified focused Yoga checks, TypeScript/Vite production build, Capacitor sync, JDK 21 Gradle assembly, package/version metadata, APK v1/v2 signatures, transparent 540 × 720 frame dimensions, exact mirrored hip-opener pairs, packaged replacement assets, and matching source/release/Drive hashes. Browser QA passed at 412 × 915 with reduced-motion emulation and no console errors. The APK installed in place on the connected Android device; its screen was locked during the final physical visual check.
- Release copies: `S:\zENcHAD\ZenChadAndroid\releases\ZenChad-2.7-Run-Warmup-Art-Fix.apk` and `D:\My Drive\ZenChad\ZenChad-2.7-Run-Warmup-Art-Fix.apk`.

# Zen Chad 2.6 — breathing, restored NSDR, and long-form music (2026-09-21)

- Added visible breathing guidance to all thirteen narrated meditation styles and inserted one approved spoken breathing passage into every narration except the already-complete NSDR Protocol.
- Restored all four older NSDR journeys as ten-minute choices alongside the protocol, preserving every original body-scan cue at natural speech speed while tightening only quiet intervals.
- Added six five-minute stereo music tracks as a shared offline pool across every meditation. Each soundtrack now plays its local A/B tracks and all six long tracks before repeating, with eight-second equal-power crossfades.
- Added a persistent music-cycle counter so each new session receives a deterministic shuffled order that advances across app shutdowns and phone restarts; an active timer restores its exact queue and playback position.
- Re-encoded all 53 narration variants as 48 kHz mono Opus and retained pre-insertion masters outside packaged assets. Packaged narration fell from 203.76 MB to 77.70 MB.
- Version code 17; version name 2.6; shareable debug APK for side-loading and in-place updates.
- Artifact: `Zen-Chad-2.6-Breathing-NSDR-Long-Music.apk`, 391,449,737 bytes—108,672,666 bytes smaller than 2.5.
- SHA-256: `F89FACFC26B4781A9012F90ED1EA2650C15B3CDADD3ECE39F26CBD750113DEA9`.
- Verified all 53 narration candidates for duration, full decode, opening silence, cue overlap, codec and bitrate; verified four restored NSDR tracks at 600.006 seconds; passed persistent music-counter/shuffle tests, TypeScript/Vite production build, Capacitor sync, JDK 21 Gradle assembly, package/version metadata, APK v1/v2 signatures, and packaged music/NSDR asset checks. No live Android device test was available.
- Release copies: `S:\zENcHAD\ZenChadAndroid\releases\Zen-Chad-2.6-Breathing-NSDR-Long-Music.apk` and `D:\My Drive\ZenChad\Zen-Chad-2.6-Breathing-NSDR-Long-Music.apk`.

# Zen Chad 2.5 — canonical 10-minute NSDR protocol (2026-09-21)

- Replaced rotating story-style NSDR guidance with one canonical, breath-led 10-minute non-sleep deep rest protocol based on the supplied reference script.
- Added explicit three extended-exhale instructions, progressive body scanning, contact/sinking cues, gentle movement, and gradual reorientation.
- Generated with the approved adam owls soothing v2 / Eleven v3 settings; old NSDR assets remain on disk but are no longer referenced by the app.
- Version code 16; version name 2.5; shareable debug APK for side-loading and in-place updates.
- Artifact: `Zen-Chad-2.5-NSDR-Protocol.apk`, 500,122,403 bytes.
- SHA-256: `094AF1FA8C71449F6DDCEC6DD89BB283862101C26BFB72FECFA03A3988A00BD2`.
- Verified with ElevenLabs generation/resume (13 cues, 0 retries), exact 600-second audio duration, 15-second opening silence, Opus 48 kHz mono format, clean decode, catalogue audio verification, TypeScript/Vite production build, Capacitor sync, JDK 21 Gradle assembly, package/version metadata, APK v1/v2 signatures, and packaged NSDR asset presence. No Android device test was available.
- Release copies: `S:\zENcHAD\ZenChadAndroid\releases\Zen-Chad-2.5-NSDR-Protocol.apk` and `D:\My Drive\ZenChad\Zen-Chad-2.5-NSDR-Protocol.apk`.

# Zen Chad 2.4 — exact original character restoration (2026-09-13)

- Restored the large Status character from the exact supplied 1086×1448 reference instead of another visual recreation. The normal starter outfit now renders the same source bytes as the canonical portrait, guaranteeing the original short magenta hair, larger head, slim build, face and pose.
- Rebuilt the wardrobe rig on the reference's native 3:4 coordinate system, added a neutral identity-preserving underlayer for changed outfit combinations, and refitted every existing paper-doll layer to that same canvas.
- Added `ANDROID_APK_ONLY.md` to make the delivery rule explicit: this project is for the Android APK; its React/Vite source is only the internal Capacitor implementation and must not be treated or published as a standalone web app.
- Version code 15; version name 2.4; shareable debug APK for side-loading and in-place updates.
- Artifact: `Zen-Chad-2.4-Exact-Character-Restoration.apk`, 494,463,644 bytes.
- SHA-256: `C85E921666BBBD47CAB332C3CD747128D0C6E36D18E98BFAE857828EE8B74990`.
- Verified with exact reference/portrait SHA-256 equality, 1086×1448 canvas checks for the base and all eleven layers, shop/progression tests, TypeScript/Vite production compilation, Capacitor Android sync, JDK 21 Gradle assembly, package/version metadata, APK v1/v2 signatures, and packaged canonical asset presence. No Android device was connected for installation.

# Zen Chad 2.3 — FFIX character restoration (2026-09-11)

- Restored Sam's canonical slim, blue-eyed, lightly bearded, magenta-haired FFIX-style character to the Status paper doll using the supplied front/side/back model sheet as the authoritative reference.
- Rebuilt the neutral 1024×1536 paper-doll base and starter outfit, returned the default Hair item to the short layered magenta spikes, and refitted every existing alternate hair, top and wrist layer to the restored head and body landmarks.
- Kept existing cosmetic IDs, ownership, prices and equipped saves intact; old paper-doll assets remain available for rollback.
- Reduced the eleven fitted transparent layers to under 1 MB total by clearing invisible RGB data, and kept rendered QA evidence outside the packaged public bundle.
- Version code 14; version name 2.3; shareable debug APK for side-loading and in-place updates.
- Artifact: `Zen-Chad-2.3-Character-Restoration.apk`, 478,579,475 bytes.
- SHA-256: `EBC3CD3F8B74C8F5248E2FEEB2B26A56901EDF9BE1C25EE2F3B4BFC61A229579`.
- Verified with shop/progression tests, TypeScript/Vite production build, 412×915 browser rendering and wardrobe interaction, console checks, Capacitor sync, JDK 21 clean Gradle assembly, package/version metadata, APK v1/v2 signatures, and matching source/release hashes. No live Android device installation was available.

# Zen Chad 2.2 — Meditation voice playback click fix (2026-09-09)

- Fixed repeated voice re-seeking during active meditation timers, which could produce a subtle clicking/lo-fi artifact in Android WebView playback.
- Voice playback now seeks only when starting or resuming from pause; the active media clock is left uninterrupted while playing.
- Version code 13; version name 2.2; shareable debug APK for side-loading and in-place updates.
- Artifact: `Zen-Chad-2.2-Meditation-Audio-Fix.apk`, 474,487,889 bytes.
- SHA-256: `10BC1D7311F00BC288A5EF5C69E57E1239CFA173C1981A18E4526EE394E50291`.
- Verified with TypeScript/Vite production build, Capacitor Android sync, Gradle debug assembly, package/version metadata, APK v1/v2 signature verification, and matching local/Drive-copy sizes. No live Android device test was available.
- Release copies: `S:\zENcHAD\ZenChadAndroid\releases\Zen-Chad-2.2-Meditation-Audio-Fix.apk` and `D:\My Drive\ZenChad\Zen-Chad-2.2-Meditation-Audio-Fix.apk`.

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

## 2.8 — Five-minute meditation and YouTube timer (2026-09-24)
- All 17 meditations offer an exact five-minute option, retaining each phase and the closing. Short sessions use on-screen guidance and existing music; full practices retain their spoken recordings.
- Binaural Beats offers two creator-published YouTube playlists. Android opens YouTube directly (browser fallback if absent) and displays a draggable native countdown with Return to ZenChad.
- First use requests display-over-other-apps permission. YouTube handles playback and ads; timer completion does not pause YouTube. No media assets or dependencies added.
- Background return/restoration caps credited time at the selected session length.
- Verified: duration/progression/Running/music tests, 412x915 UI selection/play/pause/reset/restore/late-completion checks, TypeScript/Vite, Capacitor sync, Android assembly and matching existing signing certificate. No connected phone: native overlay permission, drag and YouTube handoff require on-device verification.
- APK: `releases/ZenChad-2.8-Meditation-YouTube.apk` (versionCode 19); matching copy in `D:\My Drive\ZenChad`.

## 2.9 — Status wardrobe fitting (2026-09-24)
- Removed old face/shoulder fragments from alternate hair, aligned the cream jacket and wrist jewellery to the current body, and kept a shared 1086x1448 source coordinate system for all equipment.
- Replaced the summary's body thumbnail with a centred face portrait that follows equipped hair.
- Measured the live header to prevent the name panel being hidden under Android's top inset; shorter screens can scroll the complete frame.
- Preserved artwork, cosmetic IDs, ownership, prices, and the original default character. No generated media or additional asset payload.
- Verified all 13 wearables visually, combined equip flow, three phone widths including simulated 32px top inset, shop/progression/Running checks, production bundle, Capacitor sync, APK assembly, signature and matching local/Drive hashes. No connected Android device.
- At 412x915: header bottom 69.59px; name glyph top 98.67px (29.08px clearance). Portrait container 64.89x86.92px, image box 62.89x84.92px, equal 1px border gaps; geometric centre error 0px.
- APK: `releases/ZenChad-2.9-Status-Wardrobe-Fix.apk`, versionCode 20; copied to `D:\My Drive\ZenChad`. SHA-256: `38A44D6699F176F95B89F118063279FDFF9B632640EA59DBBFE08BEDD5D7034F`.

## 2.10 — Breathing instructions and journal export (2026-09-24)
- Added Hear breathing instructions before a session for all 13 narrated styles, seeking into existing offline audio rather than adding files. Added explicit NSDR steps, selectable spoken journeys, a default 10-Minute NSDR Protocol, and the 15-second voice-start explanation. Five-minute sessions remain text-guided but can preview the spoken breathing passage first.
- Verified all 52 inserted breathing passages against the generated audio (aligned waveform correlation); the separate NSDR protocol already contains breathing cues. All 53 narration files are packaged; all five NSDR APK hashes match the checked sources.
- Android journal export and full-data backup now use the system Save as picker, while backup import uses the Open picker. No all-files-access request or fixed-path Tasker handoff; manual backups go to the user's chosen local/cloud document provider. Success follows a completed stream write, cancellation is explicit, empty imports are rejected, and import errors leave local data unchanged. Implementation follows Android's Storage Access Framework: https://developer.android.com/training/data-storage/shared/documents-files.
- Journals display/export newest-first by actual entry date; long text and export feedback wrap on narrow screens. Backup feedback is high-contrast and shown beside the buttons.
- Removed visible no-shame and filtered-comparison announcements from run screens; rewards and best-effort calculations are unchanged.
- Verification: journal order/timezone/Unicode/round-trip tests, sync merge, progression, Running tests, browser downloads with complete matching journal/backup content, 360/412px overflow checks, NSDR preview playback/stop/session handoff, TypeScript/Vite, Capacitor sync, Android compile, signatures and matching local/Drive hashes. No phone connected: the native document-picker interaction remains untested on-device.
- APK: `releases/ZenChad-2.10-Breathing-Journal-Export.apk`, versionCode 21, 395,627,883 bytes. Drive copy: `D:\My Drive\ZenChad`. SHA-256: `118156007DD0F6EFC0682A843C62355641D06BC8701972E7AFC7380C3A6DEFA5`.

## 2.12 - Run location names and blond hair fit
- Unnamed runs now look up road/locality names from recorded GPS positions after saving. Older unnamed runs are repaired when Running Mode opens; manually edited names are preserved. Offline/unavailable lookups retain the fallback and retry on a later visit.
- Porter blond hair is 28% larger around the forehead anchor in both the character and face portrait, giving it more volume and longer side strands.
- Running, progression and shop checks plus phone-sized browser visual checks passed. Native geocoding remains untested on a handset because no device is connected.

## 2.13 - Rebuilt clean hair layers
- Rebuilt the lilac, dark-purple Noodle and blond hair overlays to remove embedded eyes, ears, skin and shoulder fragments. Refitted each clean hairstyle for fuller, natural coverage of the head in the avatar and portrait.
- Preserved the original spiky starter appearance, wardrobe ownership and item IDs.
- Reviewed every hairstyle enlarged and through the actual 412x915 wardrobe flow. No device connected for installation testing.

## 2.14 - Complete replacement heads
- Changed the three alternate Hair cosmetics from hair-only overlays to complete replacement-head groups. Each group carries the canonical head silhouette, the original character's exact face pixels, and its fitted hairstyle.
- Preserved the first purple-spiky head unchanged as the identity source. Alternate heads now share its eyes, nose, mouth, beard and expression while retaining their distinct hairstyles.
- Reviewed all four heads together at enlarged scale and in the 412x915 Status screen, including the blond head with the alternate cream jacket. No magenta remnants, dark ear holes, duplicate features, collar fragments or browser errors remained.
