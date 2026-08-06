import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const audioDirectory = path.join(projectRoot, "public", "assets", "audio", "meditations");
const catalogueSources = await Promise.all([
  readFile(path.join(projectRoot, "audio-production", "base-catalogue.json"), "utf8"),
  readFile(path.join(projectRoot, "audio-production", "variant-catalogue.json"), "utf8"),
  readFile(path.join(projectRoot, "audio-production", "fourth-variant-catalogue.json"), "utf8")
]);
const expected = Object.fromEntries(
  catalogueSources
    .flatMap((source) => JSON.parse(source).tracks)
    .map((item) => [item.outputFile, item.durationSeconds])
);
expected["acceptance-v4-qda-v3.ogg"] = 600;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(command + " failed: " + (result.stderr || result.stdout).trim());
  }
  return result;
}

const results = [];
for (const [fileName, durationTarget] of Object.entries(expected)) {
  const filePath = path.join(audioDirectory, fileName);
  const probe = JSON.parse(run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size,bit_rate:stream=codec_type,codec_name,sample_rate,channels",
    "-of", "json",
    filePath
  ]).stdout);
  const stream = probe.streams.find((item) => item.codec_type === "audio");
  const duration = Number(probe.format.duration);
  assert(stream.codec_name === "opus", `${fileName} is not Opus.`);
  assert(Number(stream.sample_rate) === 48000, `${fileName} is not 48 kHz.`);
  assert(Number(stream.channels) === 1, `${fileName} is not mono.`);
  assert(Math.abs(duration - durationTarget) < 0.05, `${fileName} duration is ${duration}, expected ${durationTarget}.`);

  run("ffmpeg", ["-v", "error", "-i", filePath, "-f", "null", "-"]);
  const silence = run("ffmpeg", [
    "-hide_banner", "-i", filePath,
    "-af", "silencedetect=noise=-45dB:d=1",
    "-f", "null", "-"
  ]).stderr;
  const openingEnd = Number((silence.match(/silence_end:\s*([0-9.]+)/) || [])[1]);
  assert(Number.isFinite(openingEnd), `${fileName} has no detectable opening silence.`);
  assert(openingEnd >= 14.5 && openingEnd <= 17.5, `${fileName} opening silence ends at ${openingEnd}s.`);

  const metadata = JSON.parse(await readFile(filePath + ".json", "utf8"));
  assert(metadata.openingSilenceSeconds === 15, `${fileName} metadata does not record 15-second opening silence.`);
  results.push({
    file: fileName,
    durationSeconds: duration,
    openingAudioAtSeconds: openingEnd,
    megabytes: Number((Number(probe.format.size) / 1_000_000).toFixed(2))
  });
}

console.table(results);
console.log(`Verified ${results.length} tracks; total ${results.reduce((sum, item) => sum + item.megabytes, 0).toFixed(2)} MB.`);
