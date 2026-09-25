# NSDR Body-Scan and Breath-Work Audit

Audit date: 2026-09-21

## Decision

All five NSDR narrations contain a coherent body scan, whole-body rest, and a gradual return. The four original thirteen-minute journeys can therefore be restored without removing or replacing any spoken cue. They need the shared `nsdr-breathing-v1` passage from `breathing-guidance-production.json` inserted after settling and before the scan. The current ten-minute NSDR Protocol already guides deliberate breaths before its scan and must not receive the shared passage a second time.

## Coverage by narration

| Narration | Body-scan coverage | Existing breath work | Integration decision |
|---|---|---|---|
| `nsdr-v1-qda-v3` - When the City Powers Down | Left foot and leg; right foot and leg; both legs; pelvis and lower back; ribs, chest, and upper back; both hands and arms; shoulders; throat, jaw, mouth, cheeks, tongue, eyes, brow, forehead, and scalp; whole body | Natural belly movement and an easy-exhale image, but no guided cycles | Preserve cues 1-15. Insert the shared clip after cue 2 and before the first foot cue. |
| `nsdr-v2-qda-v3` - The Last Train Enters the Depot | Left foot and leg; right foot and leg; both legs; pelvis, hips, and lower back; ribs, chest, shoulder blades, and upper back; both hands, arms, and shoulders; throat, jaw, lips, tongue, cheeks, nose, eyes, brow, forehead, temples, ears, and scalp; whole head, torso, arms, and legs | Natural belly movement and an exhale image, but no guided cycles | Preserve cues 1-14. Insert the shared clip after cue 1 and before the first foot cue. |
| `nsdr-v3-qda-v3` - The Seaside Hotel Turns Down the Lights | Both feet and legs; pelvis; belly, lower back, ribs, chest, and upper back; both hands, arms, and shoulders; throat, neck, jaw, lips, tongue, cheeks, eyelids, eyes, brow, forehead, temples, ears, back of head, and scalp; whole body | Breath appears as a whole-body tide image, but no guided cycles | Preserve cues 1-14. Insert the shared clip after cue 1 and before the first foot cue. |
| `nsdr-v4-qda-v3` - The Observatory Closes for Dawn | Both feet; calves and knees; thighs and hips; lower and middle back; shoulder blades; belly and chest; both hands and arms; shoulders, throat, jaw, lips, tongue, cheeks, eyelids, brow, and forehead; whole body | Natural belly and chest movement plus a later return to breath, but no guided cycles | Preserve cues 1-14. Insert the shared clip after cue 1 and before the first foot cue. |
| `nsdr-protocol-v1-qda-v3` - 10-Minute NSDR Protocol | Feet; shins and calves; thighs and hamstrings; waist; abdomen, chest, neck, arms, back, face, top and back of head; whole body | Three guided breaths before the scan, further breath-and-body cues, ordinary-breath resets, and a strain safeguard | Preserve cues 1-13. Do not insert another breathing passage. |

## Wording review

- The shared NSDR passage keeps all breaths comfortable, makes counting optional, avoids holds, avoids asking the listener to empty or fill the lungs, and explicitly names dizziness, air hunger, discomfort, and strain as reasons to return to natural breathing.
- The current NSDR Protocol says "inhale deeply", "exhale all of your air", and "exhale completely". It also says not to force relaxation, labels the breaths easy and comfortable, returns the listener to normal breathing repeatedly, and explicitly says to stop shaping a strained breath. It is safe enough to retain as the previously approved performance, but if that passage is ever rerecorded, prefer the gentler wording in the shared script.
- None of the five scripts uses breath retention, rapid ventilation, or a claim that the practice provides medical treatment or replaces sleep.

## Retiming invariants for the four restored journeys

- Keep every original spoken cue at natural speed and in its original order.
- Keep exactly fifteen seconds of opening silence and at least eight seconds of closing silence inside the ten-minute total.
- Shorten only the quiet gaps around the preserved cues; do not time-stretch spoken audio.
- Place the shared NSDR clip at the locations above, then begin the foot scan after a short clean pause.
- Preserve the whole-body integration cue and the final gradual-return cue in every version.
- Record the final insertion timestamp and all retained cue timestamps in the retiming verification output.

## Evidence reviewed

- `audio-production/catalogue/nsdr-v1-qda-v3.json`
- `audio-production/variants/nsdr-v2-qda-v3.json`
- `audio-production/variants/nsdr-v3-qda-v3.json`
- `audio-production/fourth-variants/nsdr-v4-qda-v3.json`
- `audio-production/catalogue/nsdr-protocol-v1-qda-v3.json`
- Matching `.ogg.json` generation metadata beside all five packaged narration files
