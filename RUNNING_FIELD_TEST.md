# Zenchad Running — real-phone field test

This checklist is for the first installed Android test of Running Mode. It deliberately separates **code/build checks** from things that can only be proved by carrying the phone outside.

## Before leaving

1. Pull/build the latest `main` and install it on the Android phone.
2. Open **Running → Progress → Running diagnostics** and tap **REFRESH**.
3. Confirm the app can request location when a run begins.
4. For Story Run, set Effects and Radio Voice to clearly different levels so the independent mixer is easy to verify.
5. Start Spotify/YouTube Music before the run if testing audio coexistence.

Do not paste raw GPS coordinates into bug reports. The built-in **COPY DIAGNOSTICS** output intentionally omits them.

## Test A — Quick Run, screen on

- Choose a 20-minute Quick Run.
- Let Zenchad generate a route.
- Confirm the route preview appears and roughly matches the selected time.
- Complete the prep sequence in order.
- Walk/run at least 1 km.
- Verify elapsed time, distance and pace update.
- Verify the 1 km reward appears once.
- Follow at least two navigation instructions.
- Deliberately miss one turn if convenient; Quick Run should recalculate quietly rather than treating it as failure.

## Test B — locked-screen tracking

During the same or another run:

- Lock the phone for at least 10 minutes while continuing to move.
- Confirm the ongoing **Zenchad Run** notification remains present.
- Reopen Zenchad.
- The active run should reopen automatically.
- Distance should include the screen-off section, with no giant GPS jump.
- In Running diagnostics, web/native session IDs should agree and the native point count should be non-zero.

## Test C — navigation + external music

With Spotify/YouTube Music playing:

- Ordinary Story radio/SFX should mix over the music rather than permanently taking it away.
- A navigation instruction may temporarily interrupt/duck the music so the turn is understandable.
- When the navigation sentence finishes, external music should recover automatically.
- Verify the Story **Effects** slider changes helicopter/gunfire/stinger level without changing Spotify volume.
- Verify the **Radio voice** slider changes Story dialogue level without changing navigation volume.

## Test D — Story Run

- Start Story Mode and note the selected campaign episode.
- Confirm opening radio dialogue matches that episode rather than always saying Ghost Signal.
- Keep running until a chase triggers.
- A chase must not begin at a mapped junction, road crossing, stairs or steep descent.
- Verify the target feels relative to the pace already being run rather than an arbitrary fixed speed.
- Do not deliberately endanger yourself to test a chase outcome. Normal performance is enough.
- If the target is missed, the story should branch/raise pressure without subtracting XP.
- If a helicopter event triggers, keep moving to the mapped cover section; the audio should resolve when cover is reached.
- Lock the screen during part of Story Mode and verify dialogue/navigation still occurs from the native foreground service.

## Test E — finish/recovery/rewards

- End the run.
- Verify **WELL DONE**, celebration, summary and route trace appear.
- Check kilometre splits and best efforts.
- Story events should appear as markers on the route recap when present.
- Streak XP should be shown as a bonus and should increase global XP exactly once.
- Leave the summary and return; the same streak bonus must not pay again.
- Open Run History and verify the run is still present.

## Test F — route-service failure

When convenient, temporarily disable data/Wi-Fi before route generation:

- The briefing should say the route is unavailable but the run is not cancelled.
- **START PREP ANYWAY** should still allow the run to begin.
- GPS/time/XP/km rewards should continue without navigation.
- Re-enable data; Zenchad should continue retrying route generation and can attach navigation if it recovers.

## Test G — Health Connect (optional)

Only if the phone/watch writes compatible records:

- Finish a run first.
- Tap **ADD WATCH STATS** on the summary/history card.
- Grant Health Connect access if wanted.
- Verify matching heart-rate, step and cadence records appear when available.
- Declining Health Connect access must not affect Running or Story Mode.

Health Connect is intentionally post-run enrichment. It is not currently used as a live chase sensor.

## If anything goes wrong

1. Open **Running → Progress → Running diagnostics**.
2. Tap **REFRESH**.
3. Tap **COPY DIAGNOSTICS**.
4. Record what was happening: screen on/off, external music app, Quick/Story, and whether the problem occurred before or after a spoken navigation cue.
5. For native Android problems, capture `adb logcat` in the local/Codex debugging pass.

The first field-test goal is reliability, not pace accuracy to racing-watch standards. Background continuity, route recovery, correct audio ownership and non-punitive Story behavior are the critical checks.
