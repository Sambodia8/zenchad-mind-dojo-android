# ZenChad — The Mind Dojo

ZenChad is an Android meditation and wellbeing app built with React, Capacitor, and native Android
extensions. The source in this repository is the Android app; the browser build is only the asset layer
that Capacitor packages into the installed Android application.

The GitHub source repository contains the editable Android code, native extensions, app configuration,
and non-generated assets. The large offline meditation and soundscape audio directories remain in this
local build workspace because the current GitHub connection cannot complete a reliable upload of those
binaries.

## What is implemented

- Daily dashboard with mood check-in and deterministic meditation suggestion
- 17-practice meditation toolkit, including thirteen guided practices with four bundled offline
  narration variants each
- Lifecycle-safe multi-phase timer with pause, skip, reset, foreground audio cues, screen-wake support,
  optional background phase notifications, and recovery after backgrounding
- Trataka virtual-candle mode
- Meditation roulette adapted from the supplied emotions-wheel project
- Streaks, XP, levels, total time, session count, and seven-day activity chart
- Private local meditation journal with JSON/plain-text import and JSON export
- Emotional-regulation toolkit framework
- 26 illustrated entries for Mark's Stretches
- Five evidence-informed stretch/warm-up profiles with muscle heatmaps, explicit side switching,
  reliable tap-anywhere, timed, and optional Android speech-recognition modes
- Optional low-pressure daily reminder with no streak-loss or guilt language
- Curated listening library: “Meditations That Float My Boat”, “lowercase.”, and “Singing as Therapy”
- Offline playlist metadata and local stretch assets; external YouTube playback is clearly marked as online

All personal data is stored locally in the app's WebView storage. There is no account, analytics service,
cloud database, or embedded API key.

## Intentionally left for later guidance

- AI features are not included
- Fifty-two ElevenLabs meditation narrations are bundled offline as Ogg Opus (48 kHz mono,
  192 kbps generation target) using the approved voice/model. Each guided practice rotates among
  four variants without immediately repeating the previous one; downloadable soundscapes remain
  to be produced
- Final emotional-toolkit content and escalation resources
- Final launcher logo and icons will be supplied by the user
- Final visual branding, splash screen, badges, and unlockable rewards
- User-authored stretch ordering and pace

## Develop the Android app

```powershell
npm install
npm run dev
```

## Build and run in Android Studio

```powershell
npm run android:sync
npm run android:open
```

The native Android project is in `android/`. It uses application ID `com.zenchad.minddojo`, Android
compile/target SDK 35, native speech-recognition and offline journal extensions, and Android Studio's
bundled JDK is the recommended build runtime.

Build artifacts such as APKs, local JDK archives, Gradle output, and browser test logs are intentionally
ignored by Git. The repository contains the editable Android source and app assets.

## Content editing

- Meditation names, descriptions, phases, and YouTube searches: `src/data.ts`
- Curated YouTube categories, titles, durations, and URLs: `src/guidedMedia.ts`
- Mark's flow order: `MARKS_FLOW_IDS` in `src/data.ts`
- Approved pose images: `public/assets/stretches/`
- Visual system: `src/styles.css`

Run `npm run android:sync` after changing web code or content so the compiled assets are copied into the
native Android project.
