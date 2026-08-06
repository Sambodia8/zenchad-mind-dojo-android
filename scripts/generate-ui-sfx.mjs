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

function isInside(base, candidate) {
  const relative = path.relative(base, candidate);
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function exists(filePath) {
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
    throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout;
}

function probe(filePath) {
  const result = JSON.parse(
    run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration,size,bit_rate:stream=codec_type,codec_name,sample_rate,channels",
      "-of", "json",
      filePath
    ])
  );
  const audio = result.streams?.find((stream) => stream.codec_type === "audio") ?? {};
  return {
    durationSeconds: Number(result.format?.duration ?? 0),
    bytes: Number(result.format?.size ?? 0),
    codec: audio.codec_name ?? "unknown",
    sampleRate: Number(audio.sample_rate ?? 0),
    channels: Number(audio.channels ?? 0),
    bitRate: Number(result.format?.bit_rate ?? 0)
  };
}

function addMetadata(source, destination, sound, manifest) {
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", source,
    "-map_metadata", "-1",
    "-af", "loudnorm=I=-22:LRA=7:TP=-3",
    "-codec:a", "libmp3lame",
    "-b:a", "128k",
    "-ar", "44100",
    "-id3v2_version", "3",
    "-metadata", `title=${sound.id}`,
    "-metadata", "artist=ElevenLabs",
    "-metadata", `album=${manifest.title}`,
    "-metadata", `comment=${manifest.modelId} | ${sound.durationSeconds}s`,
    destination
  ]);
}

async function main() {
  const manifestArgument = argumentValue("--manifest");
  assert(manifestArgument, "Pass --manifest <path>.");
  const manifestPath = path.resolve(projectRoot, manifestArgument);
  assert(isInside(projectRoot, manifestPath), "Manifest must stay inside the project.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const outputDirectory = path.resolve(projectRoot, manifest.outputDirectory);

  assert(manifest.schemaVersion === 1, "Unsupported manifest schema.");
  assert(manifest.approved === true, "Manifest must be approved before generation.");
  assert(isInside(projectRoot, outputDirectory), "Output directory must stay inside the project.");
  assert(Array.isArray(manifest.sounds) && manifest.sounds.length > 0, "No sounds configured.");
  assert(manifest.sounds.length <= manifest.maxGenerations, "Generation cap exceeded.");

  const totalSeconds = manifest.sounds.reduce((sum, sound) => sum + sound.durationSeconds, 0);
  assert(totalSeconds <= manifest.maxApprovedSeconds, "Approved duration cap exceeded.");
  for (const sound of manifest.sounds) {
    assert(sound.durationSeconds >= 0.5 && sound.durationSeconds <= 30, `Invalid duration for ${sound.id}.`);
    assert(sound.prompt.length <= 450, `Prompt too long for ${sound.id}.`);
    assert(path.basename(sound.fileName) === sound.fileName && sound.fileName.endsWith(".mp3"), `Unsafe output for ${sound.id}.`);
  }

  console.log(`Manifest: ${path.relative(projectRoot, manifestPath)}`);
  console.log(`Approved batch: ${manifest.sounds.length} sounds, ${totalSeconds.toFixed(2)} seconds.`);
  for (const sound of manifest.sounds) {
    console.log(`${sound.id}: ${sound.durationSeconds}s -> ${sound.fileName}`);
  }
  if (!process.argv.includes("--generate")) {
    console.log("Dry run only. Add --generate to make the approved API calls.");
    return;
  }

  const shouldResume = process.argv.includes("--resume");
  for (const sound of manifest.sounds) {
    if (!shouldResume && await exists(path.join(outputDirectory, sound.fileName))) {
      throw new Error(`Refusing to overwrite ${sound.fileName}.`);
    }
  }

  const keyFile = path.resolve(argumentValue("--key-file") ?? defaultKeyFile);
  const apiKey = (await readFile(keyFile, "utf8")).trim();
  assert(apiKey.length > 0, "External ElevenLabs API key file is empty.");
  await mkdir(outputDirectory, { recursive: true });

  const results = [];
  for (const sound of manifest.sounds) {
    const destination = path.join(outputDirectory, sound.fileName);
    if (shouldResume && await exists(destination)) {
      const details = probe(destination);
      results.push({
        id: sound.id,
        fileName: sound.fileName,
        requestedDurationSeconds: sound.durationSeconds,
        resumedExistingFile: true,
        ...details
      });
      console.log(`Keeping existing ${sound.id}.`);
      continue;
    }
    console.log(`Generating ${sound.id}...`);
    const endpoint = new URL("https://api.elevenlabs.io/v1/sound-generation");
    endpoint.searchParams.set("output_format", manifest.outputFormat);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey
      },
      body: JSON.stringify({
        text: sound.prompt,
        loop: false,
        duration_seconds: sound.durationSeconds,
        prompt_influence: manifest.promptInfluence,
        model_id: manifest.modelId
      })
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1200);
      throw new Error(`HTTP ${response.status} for ${sound.id}; stopped without retry. ${detail}`);
    }

    const source = path.join(outputDirectory, `.${sound.fileName}.source.mp3`);
    await writeFile(source, Buffer.from(await response.arrayBuffer()));
    addMetadata(source, destination, sound, manifest);
    await rm(source, { force: true });
    const details = probe(destination);
    const detailsFromDisk = await stat(destination);
    assert(details.codec === "mp3", `${sound.fileName} is not MP3.`);
    assert(details.sampleRate === 44100, `${sound.fileName} is not 44.1 kHz.`);
    results.push({
      id: sound.id,
      fileName: sound.fileName,
      requestedDurationSeconds: sound.durationSeconds,
      requestId: response.headers.get("request-id") ?? response.headers.get("x-request-id"),
      characterCost: response.headers.get("character-cost"),
      bytes: detailsFromDisk.size,
      ...details
    });
  }

  await writeFile(
    path.join(outputDirectory, "generation.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      manifest: path.relative(projectRoot, manifestPath).replaceAll("\\", "/"),
      requestCount: results.length,
      automaticRetries: 0,
      normalization: "EBU R128 -22 LUFS, -3 dB true peak",
      results
    }, null, 2)}\n`,
    "utf8"
  );
  console.log(`Completed ${results.length} sounds with no automatic retries.`);
}

main().catch((error) => {
  console.error(`UI sound generation stopped: ${error.message}`);
  process.exitCode = 1;
});
