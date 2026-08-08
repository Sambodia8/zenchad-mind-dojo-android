# ZenChad Audio Production Plan

## Purpose

ZenChad meditation narration is generated during development and packaged with the Android app. The
installed app must never contain an ElevenLabs API key, make an ElevenLabs request, or require a
connection to begin an internal guided meditation.

This file is the durable source of truth for narration generation, soundscape mixing, approval gates,
and future variation work.

The detailed creative and production rules for the narration catalogue live in
`audio-production/NARRATION_STYLE_GUIDE.md`. Sam approved that guide on 2026-07-28, granting
continuous production authorization for all twelve base tracks without a separate approval pause for
every script. Sam then expanded that approval to four distinct variants of every narrated practice,
including four twenty-minute Yoga Nidra journeys.

## Approved voices

| Role | ElevenLabs name | Voice ID |
|---|---|---|
| Preferred audition voice | adam owls max soothing | `p8theabdjkRVofw8j1ad` |
| Alternate audition voice | adam owls soothing v2 | `qDaEJf74mtxsdGvyyq8t` |

Both are private generated/remixed voices in Sam's ElevenLabs account. Never assume a public-library
substitute is acceptable.

## Security and spending rules

- The API key remains outside the project in `D:\My Drive\ZenChad\api key.txt`.
- The Treblo API key remains outside the project in
  `D:\My Drive\ZenChad\treblo_api_key.txt`.
- Generators read the key at runtime and must never print it, copy it into the project, or write it to
  manifests, metadata, documentation, app assets, logs, or terminal output.
- Every paid batch requires an approved script or excerpt plus an explicit `--generate` flag.
- Preview manifests cap both the number of requests and total submitted characters.
- Generation tools do not retry automatically. A failed or defective result must be reported before
  another paid request is made.
- Keep generation metadata containing voice, model, settings, seed, request identifier, and output
  properties so unchanged work is not purchased accidentally.

## Current audition and first production track

The first content is an original guided acceptance meditation. Before a complete narration is created,
the approved thirty-second excerpt is rendered with both voices and both models:

- `eleven_v3`, using sparse non-spoken expressive tags.
- `eleven_multilingual_v2`, using the same spoken wording without V3 tags.

All four requests use stability `0.5`, similarity boost `0.75`, style `0`, speaker boost enabled, speed
`1.0`, seed `271828`, and `mp3_44100_128`.

### Audition result

| Preference | Sample | Voice | Model | User observation |
|---:|---:|---|---|---|
| 1 | 3 | adam owls soothing v2 | `eleven_v3` | Clear favourite; use for the current acceptance meditation |
| Joint 2 | 2 | adam owls max soothing | `eleven_multilingual_v2` | Closer to the original voice, but more robotic |
| Joint 2 | 1 | adam owls max soothing | `eleven_v3` | More soothing, but less like the original voice |
| 4 | 4 | adam owls soothing v2 | `eleven_multilingual_v2` | Least favourite |

The current production default is therefore voice qDaEJf74mtxsdGvyyq8t with model eleven_v3.
Do not replace it with the voice's similarly named V2 model; the chosen combination specifically uses
the second remixed voice through Eleven v3.

The approved ten-minute performance is now bundled as acceptance-v4-qda-v3.ogg. It preserves the
accepted voice performance while locally retiming its fourteen cues to provide exactly fifteen
seconds of opening silence and more than ten seconds of closing silence. This retiming used no paid
API calls. Previous Acceptance versions are retained outside the app as references.

All production narration uses `opus_48000_192`; Opus VBR keeps silent portions compact, so measured
whole-file averages are lower than 192 kbps while spoken cues remain around the requested quality
target. Playback remains local; the API is only used during authoring.

## Script and timing rules

- Obtain approval of the written text before any paid preview or full generation.
- For the expanded catalogue, approval of `audio-production/NARRATION_STYLE_GUIDE.md` replaces
  individual script approval. Continue through generation and integration without waiting between
  tracks unless a paid request fails or verification identifies a defect.
- Begin every narrated track with exactly fifteen seconds of silence inside its advertised
  duration. Begin speech at 00:15 and preserve eight to ten seconds of closing silence.
- Write original, compassionate, non-coercive wellness guidance. Do not copy meditation-app scripts or
  present the practice as medical treatment.
- The desired creative direction is whimsical, nocturnal, star-lit, gently surreal, emotionally
  sincere, and playful with nature-and-technology imagery. Keep it wholly original: do not imitate a
  living artist's style, reuse recognisable lyrics or signature phrases, or label the work as if Adam
  Young or Owl City created or endorsed it.
- Preserve spacious delivery with short spoken cues and intentional quiet.
- Write spoken counts as words separated by ellipses, such as `one... two... three...`, so the model
  does not rush them. Eleven v3 does not use SSML pause tags.
- Use V3 audio tags sparingly and only when they support calm, believable delivery.

## App playback and mixer direction

- Final narration and soundscapes are separate offline assets mixed during playback.
- Narration is currently packaged as Ogg Opus at a 192 kbps target (48 kHz mono); preserve an MP3
  fallback only if device testing finds a WebView compatibility issue.
- A meditation session supports three simultaneous layers: narration, one ambient soundscape, and one
  optional tonal or binaural layer.
- Each source has its own zero-to-one-hundred volume control. Selected sources and per-source volumes
  persist locally and restore on the next app launch.
- Start with a hybrid soundscape architecture: support the current generated textures while allowing
  polished, licensed offline loops to replace them without changing the mixer UI.
- Pausing, resuming, resetting, jumping phases, and completing a timer must keep every audio layer in
  sync and stop all active sources when the session ends.

### Gapless loops and meditation cues

- Meditation music must be decoded once into a Web Audio buffer and looped by an
  `AudioBufferSourceNode`. Do not return to `HTMLAudioElement.loop` for compressed Ogg music: Android
  WebView produced a perceptible 0.2–0.3 second decoder/restart gap at every boundary even though the
  packaged files contained no internal silence.
- The default in-app section cue is the single-note reverse glockenspiel at
  `public/assets/audio/ui/reverse-glockenspiel-chime.ogg`. It is derived from the user-supplied source
  retained under `audio-production/source-audio/`, and plays at 65 percent of its already-gentle
  −17.8 dB peak. It plays only when moving between sections, never when initially pressing Play.
- Narrated meditations end with one of four offline Eleven v3 recordings of “Namaste” using voice
  `qDaEJf74mtxsdGvyyq8t`. The variants use soft, warm, reassuring, and thoughtful directions and
  rotate without an immediate repeat. This replaces the phase chime at final completion; sound-led
  practices without narration retain their selected completion cue.
- The approved four-call ending manifest is `audio-production/namaste-endings.json`. Generation uses
  `opus_48000_192`, fixed per-variant seeds, an explicit `--generate` flag, and no automatic retries.

### Charging and unplugged voice catalogue

- Offline charging voice prompts use the same preferred voice #3 (`qDaEJf74mtxsdGvyyq8t`) and Eleven
  v3, packaged as 48 kHz mono Ogg Opus at the 192 kbps target. They are authored in the established
  whimsical, starry, gently technological world, while remaining original rather than imitating an
  artist's lyrics or signature phrasing.
- Time-of-unplug clips cover overnight (22:00–05:59), morning (06:00–11:59), afternoon (12:00–16:59),
  and evening (17:00–21:59), with three variations per window. Charging thanks cover 0–15%, 16–39%,
  40–79%, and 80–100% battery, with the emotional direction moving from relieved to pleasantly
  surprised.
- The 16-call approved manifest is `audio-production/charging-voice-catalogue.json`, generated by
  `npm run audio:charging -- --generate` with no automatic retries. `src/chargingAudio.ts` provides
  the time and battery selectors and avoids immediately repeating a time-window variation.
- The current app has no Android power-event listener yet. The catalogue is packaged and ready for
  that future unplug/charging hook; do not generate speech at runtime or expose the API key.

### Tasker distribution

- Until the app grows a native power-event listener, the offline charging catalogue is usable through
  Tasker. The importable profile is `audio-production/tasker/ZenChad-Charging-Voice.prf.xml`.
- The Drive handoff lives at `D:\My Drive\Tasker\ZenChad Charging\`. Copy that whole folder to
  `/storage/emulated/0/Tasker/ZenChad Charging/` on the phone, then import the `.prf.xml` file.
- The profile uses the existing Power State context: charging entry selects one of four battery-band
  thank-yous; unplug exit selects one of three variations for the current local time window. Disable
  any older charging-sound profile to avoid overlapping playback.

### Soundscape generation pilot

Sam approved a four-theme ElevenLabs audition covering Metta, Urge Surfing, Trataka, and Yoga Nidra.
The audition compares two native thirty-second seamless loops from `eleven_text_to_sound_v2` with two
one-minute instrumental outputs from `music_v2` for each theme. Music sources are retained, and
fifty-five-second audition loops are prepared locally using a five-second wraparound crossfade.

The sixteen-request pilot completed with zero retries and remains outside the app pending Sam's
listening decision. All sixteen final files are labelled 48 kHz stereo Ogg Opus and decode cleanly.
The eight Sound Effects responses reported 2,400 credits total. The account's shared-pool usage rose
by 15,128 credits across the full pilot, implying approximately 12,728 credits, or 1,591 credits per
generated minute, for Music v2. This is materially above the public approximate 900-credit figure.
Use the observed rate, rounded conservatively to 1,600 credits per Music v2 minute, for future budgets.
Natural loudness spans approximately -56 to -12.7 LUFS; level-match only the selected production
assets rather than altering the raw audition files.

Pilot locations:

- Approved prompts and cap: `audio-production/soundscape-pilot.json`
- Reusable zero-retry generator: `scripts/generate-soundscape-pilot.mjs`
- Audition files and metadata: `output/elevenlabs-tests/soundscape-pilot/`

### Production meditation-music catalogue

Sam preferred ElevenLabs Music A over Music B and approved the calm no-Port-Blue Treblo Metta sample
as the template for the second music choice. The Port Blue prompt experiment is rejected: it produced
jazzy, brass-heavy music and an unusable faded ending. Do not use Port Blue in future ZenChad music
prompts.

The completed production catalogue contains two offline music beds for every one of the thirteen
narrated meditation styles:

- Music A uses the preferred ElevenLabs `music_v2` direction.
- Music B uses Treblo Melodia v3 with the shared calm ambient tag family and explicit negative tags
  for jazz, brass, horn, saxophone, trumpet, trombone, swing, and big band.
- Metta uses the approved no-Port-Blue Treblo sample. The other twelve Treblo tracks were generated
  in one capped sequential batch.
- The four preferred ElevenLabs pilot tracks cover Metta, Urge Surfing, Trataka, and Yoga Nidra. Nine
  new Music A tracks complete the other styles.

All 21 new paid generations succeeded with zero retries. The twelve Treblo tracks consumed 1,200
trial credits. The nine one-minute ElevenLabs tracks consumed 14,319 credits, consistent with the
observed planning rate of approximately 1,600 credits per generated minute.

Every selected source is retained. Production loops remove the generated outro before applying a
five-second wraparound crossfade. Verification detected long near-silent passages in the original
Treblo Sound Awareness and Focused Attention loops; both were repaired locally from their preserved
sources with no additional API calls. The final 26-track catalogue has zero detected silence events,
fully decodes as 48 kHz stereo Ogg Opus, spans 39.527 to 55.006 seconds per loop, and totals 28.85 MiB.

The music layer is bundled into the app under `public/assets/audio/soundscapes/`. It is enabled by
default at 20 percent, has an independent persisted volume and enable switch, resumes in sync with the
timer, and alternates between A and B without immediately repeating the previous music choice for that
meditation. Narration retains its separate persisted volume. The future third ambient or tonal layer
remains separate and must not be collapsed into this music control.

Production locations:

- Capped Treblo manifest: `audio-production/treblo-soundscape-production.json`
- Capped ElevenLabs manifest: `audio-production/elevenlabs-music-a-production.json`
- Reusable zero-retry generator: `scripts/generate-soundscape-production.mjs`
- Two-track packaging manifest: `audio-production/soundscape-catalogue.json`
- Packaging and verification tool: `scripts/prepare-soundscape-catalogue.mjs`
- Verification record: `audio-production/soundscape-catalogue-verification.json`
- App rotation catalogue: `src/soundscapeAudio.ts`

## Narration variation

- Each narrated meditation contains four approved variants with different central stories, imagery,
  and language.
- Choose a variant automatically at session start and, when at least two exist, never immediately
  repeat the last-played variant for that meditation.
- Store the last-played variant locally. Do not require a network call or generate audio at runtime.
- Preserve model, voice, script revision, settings, and generation provenance for every bundled
  variant.

## Base narration catalogue

The first complete offline narration set contains twelve tracks:

1. Metta (Loving Kindness)
2. Pratyahara
3. NSDR
4. Rotating Sound Awareness
5. Ego Inquiry
6. Ajna Chakra
7. Urge Surfing
8. Radical Acceptance
9. Trataka
10. Diaphragmatic Breathing
11. Focused Attention
12. Grounding

Match existing app timer lengths for the nine existing practices. Add the three new practices as
ten-minute timers. Binaural beats, frisson, TRIPP VR, and Maloka VR remain sound-led or externally
guided and are outside this narration batch.

The base catalogue was completed on 2026-07-28. Eleven new tracks used 138 sequential ElevenLabs cue
requests and 20,512 characters with zero retries; Acceptance was retimed locally. All twelve files
decode cleanly, begin audible speech at approximately 00:15, match their timer durations within 0.007
seconds, and total 56.78 MB. The three new app practices are Diaphragmatic Breathing, Focused
Attention, and Five-Sense Grounding.

## Expanded four-variant catalogue

The expanded catalogue was completed on 2026-07-28. It adds three genuinely different story variants
to each of the twelve original narrated practices and adds Yoga Nidra as a thirteenth narrated
practice with four twenty-minute variants. Yoga Nidra uses a spacious, intricate body rotation
covering the fingers, hands, arms, toes, feet, legs, torso, back, jaw, lips, tongue, cheeks, eyes,
brow, forehead, scalp, and finally the whole body.

The first 27 expansion tracks used 356 sequential ElevenLabs cue requests and 37,194 characters with
zero retries. A fourth variant for every type then used another 168 cue requests and 19,932
characters with zero retries. The complete set is 52 offline Ogg Opus files. All files decode
cleanly at 48 kHz mono and totals 201,973,848 bytes. Every track starts audible speech at
approximately 00:15 and matches its advertised timer
duration within 0.007 seconds. The app chooses among four variants at session start, remembers the
last-played variant locally, and excludes it from the next selection for the same practice.

Future production should retain the approved continuous workflow: stop only for a failed paid
request, defective audio, a security issue, or a technical condition where continuing would waste
credits.

## Working locations

- Approved generation manifests: `audio-production/`
- Reusable generator: `scripts/generate-elevenlabs-preview.mjs`
- Audition outputs: `output/elevenlabs-tests/`
- Final app-ready narration: `public/assets/audio/meditations/` after voice/model and full-script
  approval

Run a dry check before a paid batch:

```powershell
npm run audio:preview -- --manifest audio-production/acceptance-30s.json
```

Run only after the manifest is approved:

```powershell
npm run audio:preview -- --manifest audio-production/acceptance-30s.json --generate
```
