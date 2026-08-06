---
title: Zen Chad Journal Model Test
emoji: 🧘
colorFrom: indigo
colorTo: green
sdk: gradio
sdk_version: 5.42.0
app_file: app.py
pinned: false
---

# Zen Chad private journal model test

Create this as a **private** ZeroGPU Space. Do not commit journal transcripts or
generated results to the Space repository; paste a transcript into the UI only
when running a comparison.

The original 0.6B/1.7B/1B screen found no candidate that met the faithfulness
gate. The Space now contains the Qwen3 4B Instruct 2507 backup candidate and
uses the same locked prompt and deterministic decoding. Model weights are
downloaded and loaded on Hugging Face's server rather than the local computer.
