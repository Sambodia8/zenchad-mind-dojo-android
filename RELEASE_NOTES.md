# Zen Chad 2.27 — complete Eleven v4 meditation audio (2026-10-08)

- Finished the final original meditation, When the City Powers Down, with voice `zFkVchYwoYAFyxBrr2oH` and `eleven_v4`. Generated its15 original passages plus its existing breathing passage:16 cues,3341 tagged prompt characters. Preserved the current ten-minute app duration, delivery tags, breathing text and quiet imagery; added one gentle city sound prompt.
- Regenerated all four shared Namaste endings in the same v4 voice (180 tagged characters). All53 guided meditation tracks and all four shared endings now have complete v4 audio. The12 missing alternate takes were not generated; their complete first takes remain in the app.
- Made20 successful API requests with no retries, within the user's explicitly authorized final-track/endings scope. API allowance fell from100,007 to99,653 credits (354 used). Retained the previous narration and endings as local backups. No narration overlaps or final-cue truncation; no phone playback check performed.
- Added mandatory Google Drive APK delivery instructions to the workspace and canonical app AGENTS.md files. Delivery target: `D:\My Drive\ZenChad`, cloud folder `1xbd93biF2K7tvGhpA_9NMpk-W60sblmh`.
- APK: `ZenChad-2.27-Complete-Eleven-v4.apk`, version2.27/code38, package `com.zenchad.minddojo`;545,111,418 bytes. SHA-256: `E045C40B7EACA4A7CDDAEA335AD89724140D6022D84B2C080180AB1410D1B57C`. Bundle and Capacitor sync passed; after cached AAPT2 failed to start, packaging passed using installed SDK35 AAPT2. v1/v2 signatures verify with the unchanged certificate.
- Verified all53 packaged narration/metadata hashes and all four new endings; only the final NSDR narration and four endings changed from2.26. APK growth4,212,085 bytes; updated audio accounts for4,211,332 bytes. Retained previous releases and source backups.
- Copied the identical numbered APK to `D:\My Drive\ZenChad\ZenChad-2.27-Complete-Eleven-v4.apk`; source and Drive-folder SHA-256 hashes match. Sam explicitly chose "Keep paused; APK remains queued" on2026-10-08. Leave Drive syncing paused; cloud delivery is awaiting sync. Do not ask again or resume it for this release without a new instruction.

# Zen Chad 2.26 — meditation alternate takes (2026-10-07)

- Integrated the 40 complete alternate Eleven v4 performances (488 cues) into the existing meditation entries, preserving their scripts, bracketed delivery/SFX prompts, cue positions and track lengths. The other 12 upgraded entries retain their complete first performances. First-take audio and sidecars are backed up locally.
- Completeness audit: 52 of 53 bundled meditations have complete v4 narrations (674 cues); no partially regenerated meditation. The legacy `nsdr-v1-qda-v3` (When the City Powers Down) remains on its previous narration. Twelve of the 52 upgraded tracks have no alternate performance yet (186 cues).
- Assembled existing downloads locally without API requests or additional ElevenLabs credits. Verified all 40 track lengths and clip boundaries, all 53 packaged narration/sidecar hashes, and retained first-take backups. No device installation or listening check was performed. Drive remains paused.
- APK: `ZenChad-2.26-Meditation-Alternate-Takes.apk`, version2.26/code37, package `com.zenchad.minddojo`; 540,899,333 bytes. SHA-256: `7FAB42F850ABB75B4D1E66D306CCB6031BEF14F2354CED870AD8695D3149B2E2`. Production bundle, Capacitor sync and JDK21 Gradle assembly passed. APK v1/v2 signatures verify with the same certificate as2.25.
- Compared with2.25, 40 alternate narrations add2,103,008 bytes of uncompressed audio; total APK growth is1,353,107 bytes after packaging/compression and metadata changes. Exactly one numbered local release was created;2.25 is retained for rollback.

# Zen Chad 2.25 — Eleven v4 meditation re-voice (2026-10-07)

- Re-voiced 52 approved guided meditation tracks with Adam soothing owls (`zFkVchYwoYAFyxBrr2oH`) and Eleven v4. All 674 timed segments retain their spoken words and positions, with `[soft, slow, warm voice]` guidance on each. Added 63 subtle scene-matched sound-effect cues across 42 tracks; ten abstract practices remain free of environmental effects.
- Preserved existing emotion and delivery cues, track lengths, output settings, and source audio backups. Forty alternate sets of cue MP3s are staged locally under ignored `output/eleven-v4-revoice/ui-downloads/sfx-v4-alternates/`; they are not bundled. The legacy `nsdr-v1-qda-v3` app track was outside the approved manifest set and remains unchanged.
- APK: `ZenChad-2.25-Eleven-v4-Meditation-Revoice.apk`, version 2.25/code 36, package `com.zenchad.minddojo`; 539,546,226 bytes. SHA-256: `EC6C4BD4EA6F15FEEA21329EBBD644DC68127D555352CDAAF669EAAFA1EE2718`.
- Verified v1/v2 APK signatures and the same signing certificate as 2.24. All 52 refreshed audio assets in the APK match their source hashes. Compared with 2.24, the APK grew by 113,598,222 bytes; those 52 narration files account for 113,155,343 bytes of growth.
- The signed-in UI changed from showing a free promotional balance to `100,007 credits remaining`; generation stopped after that switch. The final 10-track alternate batch exceeded the last displayed promotional balance by about 2,500 prompt characters, so a small crossover into the regular balance may have occurred; the UI history does not show the exact debit.
- Local release: `S:\zENcHAD\ZenChadAndroid\releases\ZenChad-2.25-Eleven-v4-Meditation-Revoice.apk`. Drive upload remains paused per Sam's earlier instruction.

# Zen Chad 2.24 — Bike Quest warm-up and activity completion (2026-10-06)

- Bike Quest warm-up saves its position, resumes paused, and returns through Continue Bike Quest. Finishing cycling opens the optional enjoyment/effort check-in; Done saves and returns Home. Partial feedback, history and one-time rewards survive reload.
- Created 11 Mark assets: exercise clothes, tying trainers, standing quad stretch based on the supplied photo, standing calf stretch, and animated frame sheets for knee lifts, shallow knee bends, reverse lunges, hip circles, front/back and lateral leg swings, and ankle circles. Knee lifts and lunges visibly alternate. Calf raises are replaced; saved old routines retain a compatible movement alias.
- Meditation, silent practice, independent yoga and Running completion finish at Home. Guided meditations within an existing mystery sequence continue that sequence. Warm-ups are excluded from standalone activity counts.
- Home shows genuine completed sessions and active days across today plus the previous six local dates, with movement target achievements calculated across seven elapsed days. Duplicate history/receipt records count once; empty indicators remain hidden.
- Fixed paused/reopened yoga time inflating XP, understated yoga completion XP, recovered silent-practice Done navigation, and a Running results freeze when elevation had insufficient GPS points.
- Checked actual completion/navigation, saved feedback, reload reward protection, animation playback and asset loading at 412 × 915. Rendered dark and forced-light text/selected states were inspected and contrast corrected. The product currently exposes dark appearance only. Focused progression, Running, yoga/timing, receipt migration/sync, progress and Bike completion tests passed. No connected Android device was available.
- APK: `ZenChad-2.24-Bike-Quest-Completion.apk`, version 2.24/code 35, package `com.zenchad.minddojo`; 425,948,004 bytes. SHA-256: `63B2FB07524EB6CDA63E7CD62762F9FF3B8B488E1AC7A3EFC07D0091E7A437FA`.
- Verified APK v1/v2 signatures and the unchanged 2.23 signing certificate. All 11 packaged new assets match source hashes; seven NSDR audio/music files match 2.23. Growth of 18,014,071 bytes is principally the new raster artwork plus regenerated UI/packaging.
- Local release: `S:\zENcHAD\ZenChadAndroid\releases\ZenChad-2.24-Bike-Quest-Completion.apk`. After the direct Drive upload timed out, Sam requested local delivery and instructed that Drive remain paused. No cloud copy is claimed or pending.

# Zen Chad 2.23 — meditation timer and focus practice (2026-10-03)

- Added an immersive countdown and stopwatch, exact custom durations from one minute to three hours, pause/resume, hidden clock and XP, and remembered settings. Library and Toolkit shortcuts open the new timer; existing guided playback is retained.
- Added a silent 13-minute Focus & refocus adaptation, source-linked evidence wording, a dated optional eight-week goal, weekly totals and an in-app encouragement preference. Only a full focus-preset session counts toward a goal day; shorter practice still earns ordinary rewards.
- Android persists monotonic active time, schedules exact countdown alarms, restores sessions after process recreation, and recovers a reboot as interrupted. Permission guidance offers screen-awake operation. A bundled bowl follows Android sound settings; completion receipts and rewards save together to prevent duplicate awards.
- Timer, reward boundary, pause, early finish, recovery, duplicate completion, midnight goal, older-data migration and sync checks passed, along with progression, ZenPoints, guided-music, Running and theme checks. Three native clock unit tests, TypeScript/Vite, Capacitor sync and Gradle assembly passed.
- Rendered setup, active, paused, hidden-clock, finish, completion, focus and goal states were checked at 412 × 915. Final measured new-text contrast is at least 8.53:1, including selected and disabled controls. Reduced-motion rendering was verified. The current app exposes dark appearance only. OS text-scale emulation did not enlarge fixed-pixel text; actual Android font scaling still needs a device check.
- No Android device was connected. Locked-screen sound, background/process and reboot recovery, denied permission transitions, alarm cancellation and a single audible completion cue remain physical-device follow-ups.
- Version 2.23/code 34; package `com.zenchad.minddojo`; APK `ZenChad-2.23-Meditation-Timer-Focus.apk`. v1/v2 signatures verify with the same certificate as 2.22. Both bundled bowl copies and the landscape match source hashes; all five NSDR narrations and both NSDR music tracks are unchanged from 2.22.
- Size: 407,933,933 bytes; SHA-256: `6ECD9B01ED25F78370DF2884726F66107E8639E2740F772B80EF5D0B58D0B07E`. The 453,298-byte increase is the two local bowl copies plus the timer's web/native code; existing offline media were retained. The numbered local APK is ready; the background upload to the established ZenChad Drive folder is pending.

# Zen Chad 2.20 — step-by-step run preparation and readability (2026-09-30)

- Restored the seven-step rewarded Quick/Story run preparation, including the guided Before Running stretches. Equipment and travel planning remains available separately and cannot bypass the steps by accident.
- Replaced the overwhelming Hype List introduction with an optional equipment checklist, corrected its pale button/input contrast in both themes, and fixed the preparation heading and timer contrast.
- Aligned the visible centre part of the Porter Robinson blond hair with the canonical Status face.
- Confirmed the single Android release line: 2.5's larger APK included 203.76 MB of narration; 2.6 re-encoded that narration to 77.70 MB while retaining and extending NSDR. This release builds on the newer 2.19 source tree.
- Version code 31; version name 2.20; shareable APK: `ZenChad-2.20-Run-Prep-Readability.apk`.
- Running, Yoga and Shop checks passed; the browser walked through all six preparation actions into guided stretches at 412 x 915. Both themes were inspected for readable controls. TypeScript/Vite build, Capacitor sync and Gradle debug assembly passed.
- APK package `com.zenchad.minddojo` is signed with the same certificate as 2.19; v1/v2 signature verification passed. All five packaged NSDR narrations and the latest Supine Twist artwork match 2.19 byte-for-byte. No Android device was connected for installation.
- Size: 407,804,007 bytes; SHA-256: `54F7284A5A7E03767A7DC18DAC7027CC053900C4BEDAE649B60BF64958A5B9CA`. Most of the roughly 3.8 MB increase over 2.19 comes from the Haunted House Jersey assets added to the current source tree after that release; the NSDR tracks did not change. Local and Drive release copies have matching hashes.

# Zen Chad 2.19 — Supine Twist anatomy correction (2026-09-27)

- Reworked the Supine Twist from a clear reference pose: torso and pelvis rotate as one, the bent knee crosses the midline, and both shoulders remain grounded. The hip-to-thigh connection is visible and continuous.
- Version code 30; version name 2.19; shareable debug APK: `ZenChad-2.19-Supine-Twist-Anatomy-Fix.apk`.
- Verified TypeScript/Vite build, Capacitor sync, JDK 21 Gradle assembly, package/version metadata, v1/v2 signatures, and packaged Supine Twist asset hash. No connected-device check was performed.
- SHA-256: `A73AB5C5BE2868DAF772307E37AC4EC5363C22FABF48BC4278478FE8EAF74BD4`; size 403,982,233 bytes. Local and Drive copies match.

# Zen Chad 2.18 — Stretch artwork consistency fix (2026-09-27)

- Made all five refreshed stretch illustrations opaque on the same white background.
- Redrew Supine Twist with the bent knee clearly crossing the body and the shoulders grounded, so it reads distinctly from Figure Four.
- Version code 29; version name 2.18; shareable debug APK: `ZenChad-2.18-Stretch-Artwork-Fix.apk`.
- Verified TypeScript/Vite build, Capacitor sync, JDK 21 Gradle assembly, package/version metadata, v1/v2 APK signatures, opaque backgrounds, and all five packaged image hashes. No connected-device check was performed.
- SHA-256: `C8383196AAC4E9E7685BE346A81DABF3054D2F152982D04386AD1C633DCE9809`; size 403,967,615 bytes. Local and Drive copies match.

# Zen Chad 2.17 — Mark stretch illustration refresh (2026-09-27)

- Replaced the in-app illustrations for Kneeling Lunge, Half-Kneeling Quad Stretch, Seated Hamstring Stretch, Figure Four Stretch, and Supine Twist with new Mark-matched artwork based on the supplied pose references.
- Version code 28; version name 2.17; shareable debug APK: `ZenChad-2.17-Mark-Stretch-Illustrations.apk`.
- Verified TypeScript/Vite production build, Capacitor sync, JDK 21 Gradle assembly, package/version metadata, APK v1/v2 signatures, and all five packaged display assets against source hashes. No connected-device check was performed.
- SHA-256: `4F3ED74A01D10A897D44DE62E6B3C7F74195CA4B9049F73A884AEB85670AA702`; size 403,585,311 bytes.
- Release copies: `S:\zENcHAD\ZenChadAndroid\releases\ZenChad-2.17-Mark-Stretch-Illustrations.apk` and `D:\My Drive\ZenChad\ZenChad-2.17-Mark-Stretch-Illustrations.apk`; hashes match.

# Zen Chad 2.16 — Bike Quest follow-up and contrast fixes (2026-09-27)

- Added an optional “Ask me next launch” shower choice to Bike Quest. The next app launch asks whether the shower happened later and awards the chosen bonus XP to the original quest.
- Improved contrast for Bike Quest reward and feedback text, plus the Running screen headings and quick-run card.
- Version code 27; version name 2.16; shareable debug APK: `ZenChad-2.16-Bike-Quest-Contrast.apk`.
- SHA-256: `8E00002E0886613ECE9063E1B46ADC2911EC0E0B61BED2BCF17E7B7DDB16BF5D`.
- Verified TypeScript/Vite build, Capacitor sync, JDK 21 Gradle assembly, package/version metadata, and APK v1/v2 signatures. No connected-device check was performed.
- Release copies: `S:\zENcHAD\ZenChadAndroid\releases\ZenChad-2.16-Bike-Quest-Contrast.apk` and `D:\My Drive\ZenChad\ZenChad-2.16-Bike-Quest-Contrast.apk`; both are 398,751,390 bytes.

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
