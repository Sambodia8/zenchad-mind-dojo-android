import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultKeyFile = "D:\\My Drive\\ZenChad\\api key.txt";

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isPathInside(base, candidate) {
  const relative = path.relative(base, candidate);
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
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
  const output = run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size,bit_rate:stream=codec_type,codec_name,sample_rate,channels,bit_rate",
    "-of", "json",
    filePath
  ]);
  const data = JSON.parse(output);
  const audio = (data.streams || []).find((stream) => stream.codec_type === "audio") || {};
  return {
    durationSeconds: Number((data.format || {}).duration || 0),
    bytes: Number((data.format || {}).size || 0),
    codec: audio.codec_name || "unknown",
    sampleRate: Number(audio.sample_rate || 0),
    channels: Number(audio.channels || 0),
    bitRate: Number(audio.bit_rate || (data.format || {}).bit_rate || 0)
  };
}

function validateManifest(manifest, outputPath) {
  assert(manifest.schemaVersion === 1, "Unsupported manifest schemaVersion.");
  assert(manifest.approved === true, "Manifest must be explicitly approved.");
  assert(manifest.modelId === "eleven_v3", "Production meditation manifests must use Eleven v3.");
  assert(manifest.voiceId === "qDaEJf74mtxsdGvyyq8t", "Production meditation manifests must use voice #3.");
  assert(Number.isInteger(manifest.durationSeconds) && manifest.durationSeconds > 0, "durationSeconds is required.");
  assert(manifest.openingSilenceSeconds === 15, "Production tracks require exactly 15 seconds of opening silence.");
  assert(manifest.closingSilenceSeconds >= 8, "Production tracks require at least 8 seconds of closing silence.");
  assert(isPathInside(projectRoot, outputPath), "Output must stay inside the project.");
  assert(Array.isArray(manifest.segments) && manifest.segments.length > 0, "Timed segments are required.");

  let previousStart = -1;
  let totalCharacters = 0;
  for (const [index, segment] of manifest.segments.entries()) {
    assert(Number.isInteger(segment.startSeconds), "Segment " + (index + 1) + " needs an integer startSeconds.");
    assert(segment.startSeconds > previousStart, "Segments must be ordered by increasing startSeconds.");
    assert(segment.startSeconds < manifest.durationSeconds, "Segment " + (index + 1) + " starts after the meditation ends.");
    assert(typeof segment.text === "string" && segment.text.trim(), "Segment " + (index + 1) + " needs text.");
    assert(segment.text.length <= 5000, "Segment " + (index + 1) + " exceeds the API text safety limit.");
    previousStart = segment.startSeconds;
    totalCharacters += segment.text.length;
  }
  assert(manifest.segments[0].startSeconds === manifest.openingSilenceSeconds, "The first cue must begin at 15 seconds.");
  assert(totalCharacters <= manifest.maxApprovedCharacters, "Manifest requests " + totalCharacters + " characters, over its approved limit.");
  return totalCharacters;
}

function assemble(manifest, segmentFiles, outputPath) {
  const filterParts = [
    "[0:a]atrim=duration=" + manifest.durationSeconds + ",asetpts=PTS-STARTPTS[base]"
  ];
  const mixInputs = ["[base]"];
  segmentFiles.forEach((file, index) => {
    const inputIndex = index + 1;
    const delay = manifest.segments[index].startSeconds * 1000;
    filterParts.push("[" + inputIndex + ":a]adelay=" + delay + ":all=1[cue" + index + "]");
    mixInputs.push("[cue" + index + "]");
  });
  filterParts.push(
    mixInputs.join("") + "amix=inputs=" + mixInputs.length + ":duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[mix]"
  );

  const outputFormat = manifest.finalOutputFormat || "mp3_44100_96";
  const [codec, sampleRate, bitrate] = outputFormat.split("_");
  const isOpus = codec === "opus";
  assert((codec === "mp3" || isOpus) && sampleRate && bitrate, "Unsupported finalOutputFormat: " + outputFormat);
  const encoderArgs = isOpus
    ? ["-ar", sampleRate, "-ac", "1", "-c:a", "libopus", "-b:a", bitrate + "k", "-vbr", "on", "-application", "audio"]
    : ["-ar", sampleRate, "-ac", "1", "-c:a", "libmp3lame", "-b:a", bitrate + "k"];

  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
    ...segmentFiles.flatMap((file) => ["-i", file]),
    "-filter_complex", filterParts.join(";"),
    "-map", "[mix]",
    "-t", String(manifest.durationSeconds),
    ...encoderArgs,
    "-metadata", "title=" + manifest.title,
    "-metadata", "artist=ZenChad — " + manifest.voiceName,
    "-metadata", "album=ZenChad Offline Meditations",
    "-metadata", "comment=Voice ID: " + manifest.voiceId + " | Model: " + manifest.modelId + " | Script: " + manifest.scriptRevision,
    outputPath
  ]);
}

async function main() {
  const manifestArgument = argumentValue("--manifest");
  assert(manifestArgument, "Pass --manifest <path>.");
  const manifestPath = path.resolve(projectRoot, manifestArgument);
  assert(isPathInside(projectRoot, manifestPath), "Manifest must stay inside the project.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const outputPath = path.resolve(projectRoot, manifest.outputPath);
  const totalCharacters = validateManifest(manifest, outputPath);
  const generate = process.argv.includes("--generate");

  console.log("Manifest: " + path.relative(projectRoot, manifestPath));
  console.log("Approved timed cues: " + manifest.segments.length);
  console.log("Approved characters: " + totalCharacters + " / " + manifest.maxApprovedCharacters);
  console.log("Output: " + path.relative(projectRoot, outputPath));
  if (!generate) {
    console.log("Dry run only. Add --generate to make the approved ElevenLabs requests.");
    return;
  }
  assert(!(await fileExists(outputPath)), "Refusing to overwrite existing output: " + outputPath);

  const keyFile = path.resolve(argumentValue("--key-file") || defaultKeyFile);
  const apiKey = (await readFile(keyFile, "utf8")).trim();
  assert(apiKey.length > 0, "The external ElevenLabs API key file is empty.");
  await mkdir(path.dirname(outputPath), { recursive: true });
  const workDirectory = path.resolve(projectRoot, "output", "elevenlabs-working", manifest.id);
  await mkdir(workDirectory, { recursive: true });
  const segmentResults = [];
  const segmentFiles = [];

  for (const [index, segment] of manifest.segments.entries()) {
    const order = index + 1;
    const endpoint = new URL("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(manifest.voiceId));
    endpoint.searchParams.set("output_format", manifest.segmentOutputFormat);
    console.log("Generating cue " + order + "/" + manifest.segments.length + " at " + segment.startSeconds + "s");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
      body: JSON.stringify({
        text: segment.text,
        model_id: manifest.modelId,
        seed: manifest.seed + index,
        voice_settings: manifest.voiceSettings
      })
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 800);
      throw new Error("Cue " + order + " failed without retry: HTTP " + response.status + ". " + detail);
    }

    const segmentExtension = manifest.segmentOutputFormat.startsWith("opus_") ? ".ogg" : ".mp3";
    const segmentPath = path.join(workDirectory, String(order).padStart(2, "0") + segmentExtension);
    await writeFile(segmentPath, Buffer.from(await response.arrayBuffer()));
    segmentFiles.push(segmentPath);
    segmentResults.push({
      order,
      startSeconds: segment.startSeconds,
      characters: segment.text.length,
      requestId: response.headers.get("request-id") || response.headers.get("x-request-id"),
      ...probe(segmentPath)
    });
  }

  const finalCue = segmentResults.at(-1);
  const finalCueEnd = manifest.segments.at(-1).startSeconds + finalCue.durationSeconds;
  assert(
    finalCueEnd <= manifest.durationSeconds - manifest.closingSilenceSeconds,
    "Final cue ends at " + finalCueEnd.toFixed(3) + "s, leaving less than the required closing silence."
  );
  assemble(manifest, segmentFiles, outputPath);
  const finalProbe = probe(outputPath);
  const metadata = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    manifest: path.relative(projectRoot, manifestPath).replaceAll("\\\\", "/"),
    output: path.relative(projectRoot, outputPath).replaceAll("\\\\", "/"),
    automaticRetries: 0,
    totalCharacters,
    voiceId: manifest.voiceId,
    voiceName: manifest.voiceName,
    modelId: manifest.modelId,
    seed: manifest.seed,
    voiceSettings: manifest.voiceSettings,
    openingSilenceSeconds: manifest.openingSilenceSeconds,
    closingSilenceSeconds: manifest.closingSilenceSeconds,
    segments: segmentResults,
    final: finalProbe
  };
  await writeFile(outputPath + ".json", JSON.stringify(metadata, null, 2) + "\n", "utf8");
  await rm(workDirectory, { recursive: true, force: true });
  console.log("Completed " + segmentResults.length + " cues, 0 retries.");
  console.log("Final duration: " + finalProbe.durationSeconds.toFixed(3) + " seconds.");
}

main().catch((error) => {
  console.error("Timed meditation generation stopped: " + error.message);
  process.exitCode = 1;
});
