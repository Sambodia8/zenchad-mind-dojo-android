# Local journal model evaluation

Locked first evaluation input: `F:\Folders\Downloads\journalling 03-08-26.txt` (1,520 words; SHA-256 `96D9DAB3C150BA954217F8CEBF5A8EC916C7826D5B9BC0A134EA65692F70F6AB`). Keep the supplied source file unchanged.

Compare these candidates with the exact same transcript, metadata, prompt, output limit, and deterministic decoding:

1. `Qwen/Qwen3-0.6B`
2. `Qwen/Qwen3-1.7B`
3. `google/gemma-3-1b-it`

The Space comparison is a first-pass quality screen using the original model
weights. The matching phone candidates are currently:

| Candidate | Proposed phone build | Approximate download |
| --- | --- | ---: |
| Qwen3 0.6B | `ggml-org/Qwen3-0.6B-GGUF` Q4_0 | 429 MB |
| Qwen3 1.7B | `ggml-org/Qwen3-1.7B-GGUF` Q4_K_M | 1.28 GB |
| Gemma 3 1B | `google/gemma-3-1b-it-qat-q4_0-gguf` | 1 GB |

The final comparison must rerun the winning candidates in these exact quantised
forms on the phone; quantisation can change both quality and schema reliability.

Use Qwen's non-thinking mode so hidden reasoning does not distort latency or output length. Gemma access on Hugging Face requires accepting Google's Gemma usage terms on the testing account.

Score each blind-labelled result from 0-5 for:

- factual faithfulness to the transcript;
- preservation of distinctive details and uncertainty;
- useful organization;
- natural first-person voice;
- absence of invented interpretation;
- valid schema compliance.

Record generation latency separately. Phone selection also requires measuring quantized model size, peak app memory, generation time, and device temperature on the connected Pixel 6a. Quality is the primary gate; a faster model that invents or flattens the reflection does not pass.

## Outcome

The blind comparison is complete. Qwen3 0.6B, Qwen3 1.7B, and Gemma 3 1B
failed the factual-quality gate. Qwen3 4B Instruct 2507 was substantially
better, but still failed after two general prompt-tightening passes because it
turned the speaker's uncertainty into facts and invented actions.

Do not spend the user's slow connection on a phone quantisation yet. Keep the
proven local Whisper transcription, retain the raw transcript, and redesign the
second phase as conservative organisation/light editing before another locked
quality test. See `scorecard.md` for the scores and disqualification details.

## App integration

The app now has a separate native Qwen/llama.cpp bridge and a Journal-screen
model manager. Qwen is downloaded by Android's background DownloadManager into
app-specific persistent storage, outside the APK, and is reused after normal
APK updates. The model is only called by the user-facing **Create neat draft**
action; the raw Whisper transcript remains restorable. The desktop fallback is
`scripts/download-qwen4b.ps1`, which resumes and verifies the same 2,497,280,448
byte Q4_K_M file.

Whisper now has the same in-app download control. It downloads the tested
`ggml-base.en-q5_1.bin` English model (59,721,011 bytes) into the same persistent
model storage, with visible progress and cancellation. Its official source is
`https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin?download=true`.
