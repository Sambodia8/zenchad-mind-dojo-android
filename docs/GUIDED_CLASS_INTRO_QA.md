# Guided class introduction QA — 2026-10-10

Shared implementation: `src/components/GuidedClassIntro.tsx`, `src/guidedClassIntro.css`, `src/yogaPresentation.ts`. Built-in artwork is under `public/assets/yoga/intros/`; generation references and prompt set are in `docs/guided-class-art-prompts.json`.

## Verified class matrix

| Class ID | Duration | Expanded movements | Start label | Result |
| --- | --- | --- | --- | --- |
| sun-salutation | 4:30 | 11 | START CLASS | Passed |
| full-house | 28:40 | 69 | START CLASS | Passed |
| the-ogs | 8:40 | 15 | START CLASS | Passed |
| standing-and-balance | 10:25 | 21 | START CLASS | Passed |
| hips-and-hamstrings | 10:55 | 22 | START CLASS | Passed |
| floor-and-restore | 7:40 | 16 | START CLASS | Passed |
| daily-reset | 8:40 | 15 | START CLASS | Passed |
| before-run | 5:25 | 17 | BEGIN WARM-UP | Passed |
| before-cycling | 5:55 | 14 | BEGIN WARM-UP | Passed |
| after-run | 4:50 | 9 | BEGIN COOL-DOWN | Passed |
| after-cycling | 7:30 | 13 | BEGIN COOL-DOWN | Passed |
| back-and-shoulders | 5:10 | 9 | START CLASS | Passed |
| gentle-leg-recovery | 3:00 | 7 | BEGIN GENTLY | Passed |

- Real-browser controls at 412 × 915: all 13 classes, dark and forced legacy light cascade, actual expanded sequence including sides/repetitions, title/statistics, artwork decoding, evidence/source links, all original soundtracks, selected/off/on states, keyboard volume, start/exit and immersive navigation.
- Saved custom flow: Kneeling Lunge (15s each side), Child's Pose (30s), Kneeling Lunge (20s each side), 2:00 including transitions; five movements in original order. Correct custom title, artwork, evidence and launch.
- Gentle Leg Recovery: visible acute-injury warning and NHS link; unchecked confirmation blocks start; checking enables it; unchecking blocks it again. Disabled label remains readable.
- Conservative contrast checks use final rendered text styles against the nearest actual surface and worst gradient stop: minimum 6.88:1. Screenshots inspected across all 13 classes plus custom flow and forced light styling. Product currently supports dark appearance; system-light and legacy-light styling were checked without exposing a new theme setting.
- Small 320 × 740 screen: no horizontal page overflow; warm-up skip succeeds. Full body hero composition retained; long titles can wrap without a fixed title-height limit. Both horizontal carousels are bounded and keyboard accessible; start dock clears the raised Roulette navigation control and Android safe area.
- Running: Just Run stretch choice auto-starts Before Running; skip enters Just Run. Staged quick-run prep at step 9 launches stretches; Exit returns to resume preparation, Continue resumes, and Skip advances to the warm-up walk.
- Bike Quest: real pre-bike setup launches Before Cycling; the start button remains unobstructed and Exit returns to the quest. Staged recovery launches After Cycling and Exit returns to recovery. Updated runtime screen detection prevents the resume dock competing with the new preparation action.
- Definition/timing, active yoga clock, Running/native integration and progression tests passed. TypeScript/Vite production build and Capacitor Android sync passed. No browser page errors. No connected Android phone; on-device install, physical playback and device safe-area behavior remain untested.
- Screenshot evidence: `test-screenshots/guided-class-intros/`. Reusable interaction check: `scripts/qa-guided-class-intros.mjs`, run with the existing TypeScript loader, `QA_PLAYWRIGHT` and optional `QA_BROWSER` paths.

## Android artifact

- NeuralFantasy-2.29-Guided-Class-Intros.apk, version 2.29/code40, package com.zenchad.minddojo, 545802620 bytes.
- SHA-256: 30FCAA71DD6CDC2BA68B158605ADD30FB2E406D5DB7F7FC23EAF5441A1334694.
- v1/v2 signatures verified. Certificate SHA-256: 1940e2a202bb79487a65a874ffc2b50cd3b6a3f50f06f8161e4a113147dc4394, matching 2.28.
- All 13 hero hashes match source; all 248 previous offline audio entries are byte-identical. Packaged JavaScript/CSS includes the final shared intro and context labels.
- APK growth versus 2.28: 645938 bytes. The 5589598-byte artwork addition is largely offset by 4948689 fewer bytes of ZIP alignment/signature overhead; compressed entry payload grew 5594627 bytes. No audio assets removed.

- Local and mounted Drive copies verified byte-identical; cloud confirmation pending. Direct connector upload fails above512MiB, so the APK was copied through DriveFS in a hidden logged process.
