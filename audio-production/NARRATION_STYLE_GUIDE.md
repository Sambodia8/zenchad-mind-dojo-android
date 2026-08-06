# ZenChad Narration Style Guide

Status: Approved by Sam on 2026-07-28.

Approval of this guide authorizes writing, ElevenLabs generation, verification, and app integration
for the full narration catalogue. Sam expanded that authorization on 2026-07-28 to four variants of
every narrated meditation type, including four Yoga Nidra tracks. Production may continue without a
separate approval pause between scripts.

## Creative voice

- Use the same creative world as "A Quiet Place for the Weather": soothing, tender, whimsical,
  nocturnal, star-lit, gently surreal, and emotionally sincere.
- Blend natural imagery with small pieces of imagined technology: moonlit water, radio signals,
  quiet machines, constellations, weather, glass, lanterns, maps, tides, and sleeping cities.
- Write lyrical prose, not songs. Keep every script wholly original and do not copy lyrics,
  recognisable phrases, rhyme schemes, or an identifiable living artist's exact style.
- Never claim or imply that Adam Young, Owl City, or another artist wrote, voiced, or endorsed the
  meditation. Internally, describe the direction as the ZenChad night-sky synth-pop voice.
- Give each meditation its own central image system so the catalogue feels related but not repetitive.
  Do not reuse the acceptance track's observatory and inner-weather framework as the main metaphor
  elsewhere.
- Give all four variants of a meditation genuinely different language, scene progression, and central
  story. Variants must not be cosmetic substitutions of nouns inside the same script.
- Favour warm, plain language beneath the imagery. A listener should never have to decode a metaphor
  while trying to meditate.

## Guidance and pacing

- Begin every finished track with exactly fifteen seconds of silence. This silence is included inside
  the advertised meditation duration; the first spoken cue begins at 00:15.
- Leave approximately eight to ten seconds of silence after the final words, also inside the total
  duration.
- Use short spoken passages separated by meaningful quiet. Do not fill the track with continuous
  narration or explain every silence.
- Follow a gentle arc: arrive, introduce the practice, explore it, allow quiet practice, then return.
- Use invitations rather than commands: "you might notice", "see whether", "if it feels comfortable".
  Avoid pressure, achievement language, guilt, or promises of a particular result.
- Write counts as words separated by ellipses, such as "one... two... three...", to prevent rushed
  delivery.
- Use Eleven v3 performance tags sparingly. Prefer `[softly]`, `[thoughtfully]`, and
  `[reassuringly]`; do not pepper every cue with tags.
- Vary sentence length and cue timing enough to feel human and fresh for an ADHD listener, while
  keeping the underlying practice easy to follow.

## Practice fidelity and safety

- Research each technique from credible primary or clinical sources before drafting. Preserve its
  actual mechanism rather than using the meditation name as decorative flavour.
- Keep wellness guidance non-medical. Do not promise treatment, diagnosis, trauma release, chakra
  activation, altered states, or guaranteed nervous-system effects.
- Frame spiritual imagery as an optional focus or imaginative exercise, never as supernatural fact.
- NSDR must remain a lying-down rest/body-scan practice and must not claim to replace sleep.
- Yoga Nidra is a separate twenty-minute practice with a slower, more detailed whole-body rotation.
  Every version must explicitly relax the jaw, lips, tongue, cheeks, eyes, brow, forehead, scalp,
  fingers, hands, arms, feet, legs, torso, and back before resting with the entire body at once.
- Urge surfing must distinguish noticing an urge from obeying it and must not position meditation as
  the response to an immediate safety or medical emergency.
- Trataka must permit blinking and stopping for discomfort; never instruct painful, rigid, or
  unbroken staring.
- Breathing practices must stay comfortable, avoid aggressive hyperventilation or long breath holds,
  and tell the listener to return to ordinary breathing if dizzy or strained.

## Production standard

- Default voice: `adam owls soothing v2` (`qDaEJf74mtxsdGvyyq8t`).
- Model: `eleven_v3`.
- Voice settings: stability `0.5`, similarity `0.75`, style `0`, speaker boost enabled, speed `1.0`.
- Audio request and final target: Ogg Opus, `opus_48000_192`, 48 kHz mono, with Opus VBR allowed to
  reduce the size of silence.
- Every script is stored as a readable timed draft and a machine-readable manifest before generation.
- Generation requires the external API key file and an explicit generation flag. Never log or bundle
  the key, and never retry a failed paid request automatically.
- Verify every track for exact total duration, fifteen-second silent opening, audible and unclipped
  final cue, clean decoding, expected codec/sample rate, metadata, and absence of the API key.

## Four-variant catalogue and distinct creative direction

| Meditation | Duration | Central imagery and emotional direction |
|---|---:|---|
| Metta | 09:30 | Lantern signals travelling from self, to loved ones, to strangers |
| Pratyahara | 10:00 | A quiet spacecraft dimming its outer instruments and turning inward |
| NSDR | 13:00 | A sleeping city powering down one small district at a time |
| Rotating Sound Awareness | 06:45 | Tuning an old celestial radio from far signals to near ones |
| Ego Inquiry | 09:00 | Reflections, windows, and the open sky that notices them |
| Ajna Chakra | 12:00 | A calm indigo lighthouse used as an optional point of attention |
| Urge Surfing | 09:00 | A luminous tide that rises, crests, and changes without commands |
| Radical Acceptance | 10:00 | Preserve the approved inner-weather performance, retimed for the silent opening |
| Trataka | 12:20 | A tiny friendly star held in a flame, then remembered behind closed eyes |
| Diaphragmatic Breathing | 10:00 | A soft bellows and underground garden breathing at an easy pace |
| Focused Attention | 10:00 | Guiding one small satellite back to its orbit whenever it wanders |
| Grounding | 10:00 | Returning through five sensory coordinates to a safe, ordinary room |

The two VR launchers, binaural beats, and frisson remain sound-led or externally guided and do not
receive bespoke narration in this base catalogue.

## Continuous production order

1. Batch one: Metta, Pratyahara, NSDR.
2. Batch two: Ego Inquiry, Ajna Chakra, Rotating Sound Awareness.
3. Batch three: Urge Surfing, Diaphragmatic Breathing, Focused Attention.
4. Batch four: Grounding, Trataka, and the fifteen-second-opening revision of Radical Acceptance.

For each batch, draft and self-review all three scripts, create dry-run manifests, generate cues
sequentially, assemble and verify the tracks, and integrate successful audio into the app. Continue
directly to the next batch unless a paid request fails, an output is defective, or a safety/technical
issue makes proceeding wasteful.
