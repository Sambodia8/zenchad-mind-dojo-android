# Eleven v4 meditation revoice

Final completion authorized 2026-10-08: `nsdr-v1-qda-v3-eleven-v4-zfk.json` upgrades the remaining app track, including its existing breathing insertion. This supplementary manifest has16 cues at the current600-second app timings and3341 tagged prompt characters. It is separate from the original52-track batch indexes. All53 app tracks now have v4 production manifests. Shared Namaste endings use `audio-production/eleven-v4-namaste-endings.json` (four requests,180 characters).

User-authorized on 2026-10-06 for voice Adam soothing owls (zFkVchYwoYAFyxBrr2oH) with model eleven_v4.
Every timed cue starts with [soft, slow, warm voice] so each independently generated segment carries the requested delivery direction.
Selected scene moments also include gentle, clearly auditory square-bracket sound cues: rain, water, wind, birdsong, fabric, paper, or quiet indoor ambience. Existing emotion and delivery tags are retained.
Sound cues are matched to the actual imagery, kept sparse during breath counts and body scans, and omitted where the image has no suitable sound. No loud or startling effects are requested.
The preparation script records each sound cue with its segment index and scene text, and stops if a future source edit changes that scene. Character approvals and batch totals include all tags; every segment stays within the timed generator's 5,000-character limit.
Prompting reference: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices#prompting-eleven-v4 . These custom environmental tags follow the documented syntax; their audible rendering still needs checking with the selected voice during regeneration.
Original script text, timing, output settings, and voice settings are retained from each approved source manifest.
All final audio must be regenerated from these updated prompts. Existing generated cues and reports describe the earlier prompts and must not be reused as evidence of sound-cue rendering.
Generated audio is staged under ignored output/eleven-v4-revoice/generated/; app assets are replaced only after all batches pass verification.

## Batches

- Batch 1: 10 tracks, 17015 characters; audio-production/eleven-v4-revoice/batch-01-index.json
- Batch 2: 10 tracks, 13719 characters; audio-production/eleven-v4-revoice/batch-02-index.json
- Batch 3: 10 tracks, 16647 characters; audio-production/eleven-v4-revoice/batch-03-index.json
- Batch 4: 10 tracks, 19892 characters; audio-production/eleven-v4-revoice/batch-04-index.json
- Batch 5: 10 tracks, 25798 characters; audio-production/eleven-v4-revoice/batch-05-index.json
- Batch 6: 2 tracks, 9542 characters; audio-production/eleven-v4-revoice/batch-06-index.json

Total source manifests: 52. Batches: 6. Automatic retries are disabled by the timed generator.
