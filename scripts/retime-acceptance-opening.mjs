import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(projectRoot, "public", "assets", "audio", "meditations", "acceptance-v3-qda-v3.ogg");
const sourceMetadataPath = sourcePath + ".json";
const outputPath = path.join(projectRoot, "public", "assets", "audio", "meditations", "acceptance-v4-qda-v3.ogg");
const workDirectory = path.join(projectRoot, "output", "elevenlabs-working", "acceptance-v4-retime");
const newStarts = [15, 45, 80, 125, 170, 220, 270, 315, 375, 420, 465, 510, 550, 575];

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
  return result.stdout;
}

function probe(filePath) {
  return JSON.parse(run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size,bit_rate:stream=codec_type,codec_name,sample_rate,channels",
    "-of", "json",
    filePath
  ]));
}

try {
  await access(outputPath);
  throw new Error("Refusing to overwrite existing output: " + outputPath);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const sourceMetadata = JSON.parse(await readFile(sourceMetadataPath, "utf8"));
assert(sourceMetadata.segments.length === newStarts.length, "Acceptance cue count does not match the retiming map.");
await mkdir(workDirectory, { recursive: true });

const cueFiles = [];
for (const [index, segment] of sourceMetadata.segments.entries()) {
  const cuePath = path.join(workDirectory, String(index + 1).padStart(2, "0") + ".wav");
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", String(segment.startSeconds),
    "-t", String(segment.durationSeconds),
    "-i", sourcePath,
    "-ar", "48000",
    "-ac", "1",
    "-c:a", "pcm_s16le",
    cuePath
  ]);
  cueFiles.push(cuePath);
}

const filterParts = ["[0:a]atrim=duration=600,asetpts=PTS-STARTPTS[base]"];
const mixInputs = ["[base]"];
cueFiles.forEach((cuePath, index) => {
  filterParts.push(`[${index + 1}:a]adelay=${newStarts[index] * 1000}:all=1[cue${index}]`);
  mixInputs.push(`[cue${index}]`);
});
filterParts.push(
  mixInputs.join("") +
  `amix=inputs=${mixInputs.length}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[mix]`
);

run("ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-y",
  "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono",
  ...cueFiles.flatMap((cuePath) => ["-i", cuePath]),
  "-filter_complex", filterParts.join(";"),
  "-map", "[mix]",
  "-t", "600",
  "-ar", "48000",
  "-ac", "1",
  "-c:a", "libopus",
  "-b:a", "192k",
  "-vbr", "on",
  "-application", "audio",
  "-metadata", "title=A Quiet Place for the Weather",
  "-metadata", "artist=ZenChad - adam owls soothing v2",
  "-metadata", "album=ZenChad Offline Meditations",
  "-metadata", "comment=Locally retimed approved performance; 15-second opening silence; no paid API calls",
  outputPath
]);

const finalCueEnd = newStarts.at(-1) + sourceMetadata.segments.at(-1).durationSeconds;
assert(finalCueEnd <= 590, "Retimed ending does not preserve ten seconds of closing silence.");
const metadata = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: "public/assets/audio/meditations/acceptance-v3-qda-v3.ogg",
  output: "public/assets/audio/meditations/acceptance-v4-qda-v3.ogg",
  paidApiCalls: 0,
  voiceId: sourceMetadata.voiceId,
  voiceName: sourceMetadata.voiceName,
  modelId: sourceMetadata.modelId,
  openingSilenceSeconds: 15,
  closingSilenceSeconds: 600 - finalCueEnd,
  cueStarts: newStarts,
  final: probe(outputPath)
};
await writeFile(outputPath + ".json", JSON.stringify(metadata, null, 2) + "\n", "utf8");
await rm(workDirectory, { recursive: true, force: true });
console.log(`Retimed Acceptance locally. Final cue ends at ${finalCueEnd.toFixed(3)} seconds.`);
