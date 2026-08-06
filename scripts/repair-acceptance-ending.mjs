import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultKeyFile = "D:\\My Drive\\ZenChad\\api key.txt";
const originalPath = path.resolve(projectRoot, "public/assets/audio/meditations/acceptance-v1-qda-v3.mp3");
const repairedPath = path.resolve(projectRoot, "public/assets/audio/meditations/acceptance-v2-qda-v3.mp3");
const workingDirectory = path.resolve(projectRoot, "output/elevenlabs-working/acceptance-ending-repair");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: projectRoot, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + " failed: " + (result.stderr || result.stdout).trim());
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(path.resolve(projectRoot, "audio-production/acceptance-10m.json"), "utf8"));
  if (await exists(repairedPath)) throw new Error("Refusing to overwrite the repaired output.");
  if (!(await exists(originalPath))) throw new Error("The original assembled track is missing.");

  const keyIndex = process.argv.indexOf("--key-file");
  const apiKeyPath = path.resolve(keyIndex >= 0 ? process.argv[keyIndex + 1] : defaultKeyFile);
  const apiKey = (await readFile(apiKeyPath, "utf8")).trim();
  if (!apiKey) throw new Error("The external API key file is empty.");
  await mkdir(workingDirectory, { recursive: true });

  const lastSegment = manifest.segments[manifest.segments.length - 1];
  const endpoint = new URL("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(manifest.voiceId));
  endpoint.searchParams.set("output_format", manifest.segmentOutputFormat);
  console.log("Generating one disclosed corrective ending cue at " + lastSegment.startSeconds + "s.");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
    body: JSON.stringify({
      text: lastSegment.text,
      model_id: manifest.modelId,
      seed: manifest.seed + manifest.segments.length - 1,
      voice_settings: manifest.voiceSettings
    })
  });
  if (!response.ok) throw new Error("Corrective cue failed without retry: HTTP " + response.status);
  const cuePath = path.join(workingDirectory, "ending.mp3");
  await writeFile(cuePath, Buffer.from(await response.arrayBuffer()));

  const startMs = lastSegment.startSeconds * 1000;
  const filter = "[0:a]volume=enable='gte(t," + lastSegment.startSeconds + ")':volume=0[base];" +
    "[1:a]adelay=" + startMs + ":all=1[cue];" +
    "[base][cue]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[mix]";
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", originalPath,
    "-i", cuePath,
    "-filter_complex", filter,
    "-map", "[mix]",
    "-t", "600",
    "-ar", "44100", "-ac", "1",
    "-c:a", "libmp3lame", "-b:a", "96k",
    "-id3v2_version", "3",
    "-metadata", "title=" + manifest.title,
    "-metadata", "artist=ZenChad — " + manifest.voiceName,
    "-metadata", "album=ZenChad Offline Meditations",
    "-metadata", "comment=Voice ID: " + manifest.voiceId + " | Model: " + manifest.modelId + " | Corrected final cue timing",
    repairedPath
  ]);
  await writeFile(repairedPath + ".json", JSON.stringify({
    source: "acceptance-v1-qda-v3.mp3",
    correctiveCueStartSeconds: lastSegment.startSeconds,
    requestId: response.headers.get("request-id") || response.headers.get("x-request-id"),
    automaticRetries: 0
  }, null, 2) + "\n", "utf8");
  await rm(workingDirectory, { recursive: true, force: true });
  console.log("Corrected track written to " + repairedPath);
}

main().catch((error) => {
  console.error("Acceptance ending repair stopped: " + error.message);
  process.exitCode = 1;
});
