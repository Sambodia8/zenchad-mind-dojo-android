# Running warm-up fixes — 2026-10-11

- Canonical source started at d1677c3, branch agent/merge-local-progress-ui. Latest local/Drive release was 2.30/code41. Unrelated untracked work retained.
- Video: https://www.youtube.com/watch?v=3WUtJxLv-wI. Real-frame contact review in the separately saved reference pack confirms front/back supported hip swings and rear-view lateral swings. Alternating Hamstring Sweeps is absent; its old halfway-lift fallback was not an accurate guide. Removed that step from Before Running, retaining the ID for existing custom routines. Squat-to-Forward-Fold remains.
- Sam's standing heel-to-seat quad stretch uses the existing modern Mark asset. It now immediately follows ankle inversion/eversion, ankle rocks and both leg swing sets. Both legs receive 15 seconds. Expanded class: 15 slides, 4:45 including transitions.
- The popup now uses the same saved player level as the header, rather than XP/1000+1. Save migration clamps impossible lastSeenLevel markers onto the actual curve without changing earned XP. 13,052 XP resolves to level 9.
- Active atlases fit the measured artwork area rather than the old 40vh/25rem cap. Optional source rectangles align unequal generated panels using one common canvas, one scale and the planted shoe anchor. Front/back reuses the existing anatomically appropriate artwork with corrected panel boundaries; lateral uses a new supported outward/centre/crossing illustration. No source-video pixels were generated or mirrored in the reference pack.
- Mark illustrations are explanatory keyframe loops, not motion-captured video. Second-side Mark art is mirrored by the existing player; source footage references keep actual demonstrated sides.

## Geometry and QA

412×915 viewport. Front/back cell 386.44×490.88; lateral cell 386.44×419.00. Full head, hands and both shoes remain visible throughout. Planted floor position is fixed by calibration. Playback visits 0,1,2,1, pause retains its frame, and side two mirrors the artwork. Quad stretch follows both lateral sides.

Focused yoga, saved-data and Running/native integration checks pass. TypeScript/Vite, Capacitor sync and Gradle assembly pass. Render evidence lives in test-screenshots/running-warmup-fixes locally (includes user evidence; not shipped). Dark is the supported app theme; legacy light styling was also inspected. The popup paragraph was corrected to use opaque theme ink. Measured rendered text contrast: 11.47:1 light popup, 15.66:1 dark popup, 18.32:1 movement title, 10.45:1 side badge, 5.24:1 Continue button against its brightest gradient colour. Shared Before Cycling atlas and reduced-motion still fallback also checked. No Android device was connected. Final APK package/signature/assets and delivery are recorded in release notes.

## New lateral artwork

Built-in image_gen used. Asset: public/assets/stretches/generated/running-warmup-v4/lateral-leg-swings-atlas.png. Source PNG 2073×759 RGBA. The final crossing phase required one targeted correction. Calibrated source crops and shoe anchors are recorded in src/data.ts, rather than destructively editing the generated bitmap.

The complete real-frame reference ZIP is a separate deliverable. Its status must be reported honestly; contact sheets alone are not the finished pack.
