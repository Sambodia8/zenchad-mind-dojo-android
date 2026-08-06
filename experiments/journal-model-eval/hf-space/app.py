import json
import os
import time
from pathlib import Path

# Gemma 3's rotary embeddings currently trip PyTorch Dynamo on ZeroGPU.
# ZeroGPU does not support torch.compile, so keep all candidates in eager mode.
os.environ.setdefault("TORCH_COMPILE_DISABLE", "1")
os.environ.setdefault("TORCHDYNAMO_DISABLE", "1")

import gradio as gr
import spaces
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


MODELS = {
    "Qwen3 4B Instruct 2507": "Qwen/Qwen3-4B-Instruct-2507",
}
PROMPT_TEMPLATES = {
    "Faithful neat draft": Path(__file__).with_name("neat-draft-prompt.txt").read_text(encoding="utf-8"),
    "Rich journal (legacy test)": Path(__file__).with_name("prompt.txt").read_text(encoding="utf-8"),
}
HF_TOKEN = os.environ.get("HF_TOKEN")


def load_models():
    loaded = {}
    for label, model_id in MODELS.items():
        tokenizer = AutoTokenizer.from_pretrained(model_id, token=HF_TOKEN)
        model = AutoModelForCausalLM.from_pretrained(
            model_id,
            token=HF_TOKEN,
            torch_dtype=torch.bfloat16,
        ).to("cuda")
        model.eval()
        loaded[label] = (model_id, tokenizer, model)
    return loaded


MODEL_BUNDLES = load_models()


def build_prompt(mode: str, transcript: str, session_metadata: str) -> str:
    metadata = session_metadata.strip() or "No additional metadata supplied."
    return (
        PROMPT_TEMPLATES[mode].replace("{{SESSION_METADATA}}", metadata)
        .replace("{{TRANSCRIPT}}", transcript.strip())
    )


def extract_json(text: str, mode: str) -> tuple[str, str]:
    candidate = text.strip()
    if candidate.startswith("```"):
        candidate = candidate.removeprefix("```json").removeprefix("```")
        candidate = candidate.removesuffix("```").strip()
    try:
        parsed = json.loads(candidate)
        required = (
            {"title", "body"}
            if mode == "Faithful neat draft"
            else {
                "title",
                "experience",
                "observations",
                "takeaways",
                "nextSteps",
                "reflectionQuestions",
            }
        )
        if set(parsed) != required:
            return candidate, "JSON parsed, but its fields do not exactly match the required schema."
        return json.dumps(parsed, ensure_ascii=False, indent=2), "Valid JSON with the required fields."
    except json.JSONDecodeError as error:
        return candidate, f"Invalid JSON: {error.msg} at line {error.lineno}, column {error.colno}."


@spaces.GPU(duration=120)
def run_model(mode: str, model_label: str, transcript: str, session_metadata: str):
    if len(transcript.strip()) < 20:
        raise gr.Error("Paste a journal transcript before running the test.")

    model_id, tokenizer, model = MODEL_BUNDLES[model_label]
    started = time.perf_counter()
    prompt = build_prompt(mode, transcript, session_metadata)
    messages = [{"role": "user", "content": prompt}]
    template_options = {
        "tokenize": False,
        "add_generation_prompt": True,
    }
    if model_id.startswith("Qwen/") and "Instruct-2507" not in model_id:
        template_options["enable_thinking"] = False
    rendered = tokenizer.apply_chat_template(messages, **template_options)
    inputs = tokenizer(rendered, return_tensors="pt").to(model.device)
    generated = model.generate(
        **inputs,
        max_new_tokens=1400 if mode == "Faithful neat draft" else 900,
        do_sample=False,
        repetition_penalty=1.05,
    )
    output_tokens = generated[0][inputs.input_ids.shape[-1] :]
    generated_token_count = int(output_tokens.shape[0])
    raw_output = tokenizer.decode(output_tokens, skip_special_tokens=True)
    elapsed = time.perf_counter() - started
    formatted, validation = extract_json(raw_output, mode)

    details = (
        f"Mode: {mode}\n"
        f"Model: {model_id}\n"
        f"Generation elapsed: {elapsed:.1f} seconds\n"
        f"Generated tokens: {generated_token_count}\n"
        f"Validation: {validation}"
    )
    return formatted, details


with gr.Blocks(title="Zen Chad journal model test") as demo:
    gr.Markdown(
        "# Zen Chad journal model test\n"
        "Try the conservative neat-draft editor or compare it with the earlier rich formatter. "
        "This Space should remain private."
    )
    mode_choice = gr.Dropdown(
        list(PROMPT_TEMPLATES),
        value="Faithful neat draft",
        label="Formatting mode",
    )
    model_choice = gr.Dropdown(list(MODELS), value="Qwen3 4B Instruct 2507", label="Model")
    metadata = gr.Textbox(
        label="Session metadata",
        placeholder="Optional: date, meditation type and duration",
        lines=2,
    )
    transcript = gr.Textbox(label="Raw transcript", lines=16)
    run_button = gr.Button("Generate journal entry", variant="primary")
    output = gr.Code(label="Model result", language="json")
    details = gr.Textbox(label="Run details", lines=4)
    run_button.click(run_model, [mode_choice, model_choice, transcript, metadata], [output, details])


if __name__ == "__main__":
    demo.queue(default_concurrency_limit=1).launch()
