/** Offline verification for rebuilt narration candidates. No network calls. */
import { spawnSync } from "node:child_process";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.resolve(root, process.argv.includes("--directory") ? process.argv[process.argv.indexOf("--directory") + 1] : "output/audio-package-candidates/meditations");
const strict = process.argv.includes("--strict");
function assert(value, message) { if (!value) throw new Error(message); }
function run(command, args, stderr = false) { const result = spawnSync(command, args, { cwd: root, encoding: "utf8", windowsHide: true }); if (result.error) throw result.error; if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`); return stderr ? `${result.stdout ?? ""}${result.stderr ?? ""}` : result.stdout; }
async function exists(file) { try { await access(file); return true; } catch { return false; } }
function probe(file) { const data = JSON.parse(run("ffprobe", ["-v", "error", "-show_entries", "format=duration,size:stream=codec_type,codec_name,sample_rate,channels", "-of", "json", file])); const stream = data.streams.find((item) => item.codec_type === "audio") ?? {}; return { duration: Number(data.format.duration), bytes: Number(data.format.size), codec: stream.codec_name, sampleRate: Number(stream.sample_rate), channels: Number(stream.channels) }; }
function openingSilence(file) { const output = run("ffmpeg", ["-hide_banner", "-i", file, "-af", "silencedetect=noise=-45dB:d=1", "-f", "null", "-"], true); return Number((output.match(/silence_end:\s*([0-9.]+)/) ?? [])[1]); }
async function main() {
  if (!(await exists(directory))) { if (strict) throw new Error(`Candidate directory does not exist: ${directory}`); console.log("No candidate directory yet; dry verification complete."); return; }
  const files = (await readdir(directory)).filter((file) => file.endsWith(".ogg"));
  if (strict) assert(files.length === 53, `Expected 53 narrations, found ${files.length}.`);
  const results = [];
  for (const name of files) {
    const file = path.join(directory, name);
    const record = JSON.parse(await readFile(`${file}.json`, "utf8"));
    const details = probe(file);
    assert(details.codec === "opus" && details.sampleRate === 48000 && details.channels === 1, `${name} is not 48 kHz mono Opus.`);
    assert(Math.abs(details.duration - record.targetDuration) < 0.05, `${name} duration is wrong.`);
    const averageBitRate = details.bytes * 8 / details.duration;
    assert(averageBitRate <= 72_000, `${name} exceeds the narration packaging ceiling.`);
    const opening = openingSilence(file);
    assert(opening >= 14.5 && opening <= 17.5, `${name} no longer has the 15-second opening silence.`);
    const timeline = record.excluded ? record.cues : [...record.cues, { startSeconds: record.breathingStartSeconds, durationSeconds: record.breathingClipDurationSeconds }];
    const ordered = timeline.slice().sort((a, b) => a.startSeconds - b.startSeconds);
    for (let index = 1; index < ordered.length; index += 1) assert(ordered[index - 1].startSeconds + ordered[index - 1].durationSeconds <= ordered[index].startSeconds + 0.02, `${name} has overlapping speech.`);
    run("ffmpeg", ["-v", "error", "-i", file, "-f", "null", "-"]);
    results.push({ name, duration: details.duration.toFixed(3), kbps: (averageBitRate / 1000).toFixed(1), opening: opening.toFixed(2) });
  }
  console.table(results);
  console.log(`Verified ${results.length} narration candidates with decode, timing, silence, overlap, and bitrate checks.`);
}
main().catch((error) => { console.error(`Meditation audio verification stopped: ${error.message}`); process.exitCode = 1; });
