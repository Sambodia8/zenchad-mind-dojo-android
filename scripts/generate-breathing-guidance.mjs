/** Generate the explicitly approved breathing clips. Never runs at app runtime. */
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestFile = path.join(root, "audio-production/breathing-guidance-production.json");
const generate = process.argv.includes("--generate");
function value(name) { const index = process.argv.indexOf(name); return index === -1 ? undefined : process.argv[index + 1]; }
function assert(value, message) { if (!value) throw new Error(message); }
async function exists(file) { try { await access(file); return true; } catch { return false; } }
function run(command, args) { const result = spawnSync(command, args, { cwd: root, encoding: "utf8", windowsHide: true }); if (result.error) throw result.error; if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`); return result.stdout; }
function probe(file) { const data = JSON.parse(run("ffprobe", ["-v", "error", "-show_entries", "format=duration,size:stream=codec_type,codec_name,sample_rate,channels", "-of", "json", file])); const stream = data.streams.find((item) => item.codec_type === "audio") ?? {}; return { durationSeconds: Number(data.format.duration), bytes: Number(data.format.size), codec: stream.codec_name, sampleRate: Number(stream.sample_rate), channels: Number(stream.channels) }; }
function insideProject(file) { const relative = path.relative(root, file); return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative); }

async function main() {
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  const output = path.resolve(root, manifest.outputDirectory);
  assert(insideProject(output), "Output directory must be inside this project.");
  assert(manifest.schemaVersion === 1 && Array.isArray(manifest.scripts) && manifest.scripts.length === 13, "Exactly 13 breathing scripts are required.");
  assert(manifest.generationPolicy?.automaticRetries === 0, "Breathing generation must never retry automatically.");
  assert(manifest.scripts.length <= manifest.generationPolicy.maxGenerations, "Manifest exceeds its paid-call cap.");
  const characters = manifest.scripts.reduce((total, script) => total + script.text.length, 0);
  assert(characters <= manifest.generationPolicy.maxApprovedCharacters, "Manifest exceeds its character cap.");
  const names = new Set();
  for (const script of manifest.scripts) {
    assert(script.approved === true || !generate, `${script.id} is not approved.`);
    assert(path.basename(script.fileName) === script.fileName && script.fileName.endsWith(".ogg"), `Unsafe output filename: ${script.fileName}`);
    assert(!names.has(script.fileName), `Duplicate output filename: ${script.fileName}`);
    names.add(script.fileName);
    assert(!(await exists(path.join(output, script.fileName))), `Refusing to overwrite existing clip: ${script.fileName}`);
  }
  console.log(`Manifest scope: ${manifest.scripts.length}/13 clips, ${characters}/${manifest.generationPolicy.maxApprovedCharacters} characters, zero retries.`);
  console.log(`Approval status: ${manifest.approval?.approved === true ? "approved" : "draft — generation locked"}.`);
  if (!generate) { console.log("Dry run only. No key was read and no API calls were made. Add --generate only after approving the manifest."); return; }
  assert(manifest.approval?.approved === true, "Set approval.approved only after text and spending approval.");
  assert(manifest.generationPolicy?.generationEnabled === true, "Paid generation is locked in the manifest.");
  assert(manifest.generationPolicy?.paidRequestsAllowed === true, "Paid requests are locked in the manifest.");
  const keyFile = value("--key-file");
  assert(keyFile, "--generate requires an explicit external --key-file path.");
  const apiKey = (await readFile(path.resolve(keyFile), "utf8")).trim();
  assert(apiKey.length > 0, "The external API key file is empty.");
  await mkdir(output, { recursive: true });
  const results = [];
  for (const script of manifest.scripts) {
    console.log(`Generating ${script.order}/13: ${script.fileName}`);
    const endpoint = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(manifest.voiceId)}`);
    endpoint.searchParams.set("output_format", manifest.outputFormat);
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "xi-api-key": apiKey }, body: JSON.stringify({ text: script.text, model_id: manifest.modelId, seed: 710000 + script.order, voice_settings: manifest.voiceSettings }) });
    if (!response.ok) throw new Error(`Generation stopped without retry after HTTP ${response.status} for ${script.fileName}.`);
    const destination = path.join(output, script.fileName);
    await writeFile(destination, Buffer.from(await response.arrayBuffer()));
    const details = probe(destination);
    assert(details.codec === "opus" && details.sampleRate === 48000 && details.channels === 1, `${script.fileName} has an unexpected response encoding.`);
    assert(details.durationSeconds >= 20 && details.durationSeconds <= 60, `${script.fileName} duration is outside the 20–60 second guide range.`);
    results.push({ id: script.id, fileName: script.fileName, requestId: response.headers.get("request-id") ?? response.headers.get("x-request-id"), seed: 710000 + script.order, ...details });
  }
  await writeFile(path.join(output, "generation.json"), `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), manifest: "audio-production/breathing-guidance-production.json", paidApiCalls: results.length, automaticRetries: 0, results }, null, 2)}\n`, "utf8");
  console.log(`Completed ${results.length} paid requests with 0 retries.`);
}
main().catch((error) => { console.error(`Breathing guidance generation stopped: ${error.message}`); process.exitCode = 1; });
