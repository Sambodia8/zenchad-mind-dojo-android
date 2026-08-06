# Pixel Whisper test

## Locked speech model

- Engine: official `whisper.cpp` source, pinned at v1.8.5 for the first device spike
- Model: `ggml-base.en-q5_1.bin`
- File size: 59,721,011 bytes
- SHA-256: `4BAF70DD0D7C4247BA2B81FAFD9C01005AC77C2F9EF064E00DCF195D0E2FDD2F`
- Language: English
- Processing: CPU-only, record then transcribe locally

The downloaded file hash matches Hugging Face's `X-Linked-ETag`. The model is not
committed to the app repository during the spike. It is pushed into the debug
app's external private model directory for the Pixel 6a test.

## Device gate

The automated Android test transcribes the official `whisper.cpp` JFK WAV sample
and requires the result to contain both “fellow Americans” and “country”. Record
elapsed time and peak app memory before choosing the production speech model.

After the automated sample passes, run one short real microphone recording in
the Journal screen to verify permission handling, capture quality and the full UI
flow. This first spike deliberately transcribes after Stop; live partial text can
be evaluated later without risking an increasingly delayed streaming pipeline.

## 3 August 2026 result

- Pixel 6a / Android 17: **pass**
- Transcript: exact expected sentence, including “fellow Americans” and “country”
- Optimised elapsed time: **4.814 seconds for 11 seconds of audio**
- Unoptimised debug baseline: 149.218 seconds
- Observed proportional memory during the baseline run: approximately 190 MB
- Battery temperature before and after two optimised runs: 31.2 C
- Android instrumentation: 1 test, 0 failures
- APK/native library: 16 KB ZIP and ELF alignment checks pass

The Android microphone permission prompt and a human voice recording both passed
from the Journal screen.

## Long-reflection and recovery checks

- A 300-second dense-speech PCM recording transcribed in **72.1 seconds** on the
  Pixel 6a (about 4.2x faster than real time).
- Peak observed app RSS during that run was approximately **670 MB**; it returned
  below 400 MB afterward.
- Battery temperature after the run was **31.7 C**.
- A cached unfinished recording was recovered and appended after existing draft
  text rather than replacing it.
- A silence-only recording left the existing draft unchanged and did not insert
  Whisper's `[BLANK_AUDIO]` marker.
- The screen remains awake during recording/transcription, and temporary audio is
  deleted only after successful transcription. A failed or interrupted run can be
  recovered by tapping Voice reflection again.
