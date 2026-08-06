import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(projectRoot, "audio-production", "namaste-endings.json");
const keyFile = "D:\\My Drive\\ZenChad\\api key.txt";

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout;
}

function probe(filePath) {
  const result = JSON.parse(run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size,bit_rate:stream=codec_name,sample_rate,channels",
    "-of", "json",
    filePath
  ]));
  const audio = result.streams?.[0] ?? {};
  return {
    durationSeconds: Number(result.format?.duration ?? 0),
    bytes: Number(result.format?.size ?? 0),
    bitRate: Number(result.format?.bit_rate ?? 0),
    codec: audio.codec_name,
    sampleRate: Number(audio.sample_rate ?? 0),
    channels: Number(audio.channels ?? 0)
  };
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert(manifest.approved === true, "The Namaste manifest is not approved.");
  assert(manifest.samples.length <= manifest.maxGenerations, "Manifest exceeds its paid-call cap.");
  const characterCount = manifest.samples.reduce((sum, sample) => sum + sample.text.length, 0);
  assert(characterCount <= manifest.maxApprovedCharacters, "Manifest exceeds its character cap.");

  const outputDirectory = path.resolve(projectRoot, manifest.outputDirectory);
  assert(outputDirectory.startsWith(`${projectRoot}${path.sep}`), "Output must stay inside the project.");
  for (const sample of manifest.samples) {
    assert(path.basename(sample.fileName) === sample.fileName && sample.fileName.endsWith(".ogg"), "Invalid output filename.");
    assert(!(await exists(path.join(outputDirectory, sample.fileName))), `Refusing to overwrite ${sample.fileName}.`);
  }

  console.log(`Approved scope: ${manifest.samples.length} requests, ${characterCount} text characters, no retries.`);
  for (const sample of manifest.samples) {
    console.log(`${sample.order}. ${sample.title} | ${sample.fileName}`);
  }
  if (!process.argv.includes("--generate")) {
    console.log("Dry run only. Add --generate to make the approved API calls.");
    return;
  }

  const apiKey = (await readFile(keyFile, "utf8")).trim();
  assert(apiKey.length > 0, "The external API-key file is empty.");
  await mkdir(outputDirectory, { recursive: true });

  const subscriptionResponse = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
    headers: { "xi-api-key": apiKey }
  });
  assert(subscriptionResponse.ok, `Could not check ElevenLabs allowance: HTTP ${subscriptionResponse.status}.`);
  const subscription = await subscriptionResponse.json();
  const allowanceBefore = Number(subscription.character_limit ?? 0) - Number(subscription.character_count ?? 0);
  console.log(`Allowance before generation: ${Math.max(0, allowanceBefore).toLocaleString()} credits/characters.`);

  const generatedAt = new Date().toISOString();
  const results = [];
  for (const sample of manifest.samples) {
    console.log(`Generating ${sample.order}/${manifest.samples.length}: ${sample.fileName}`);
    const endpoint = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(manifest.voiceId)}`);
    endpoint.searchParams.set("output_format", manifest.outputFormat);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey
      },
      body: JSON.stringify({
        text: sample.text,
        model_id: manifest.modelId,
        seed: sample.seed,
        voice_settings: manifest.voiceSettings
      })
    });
    if (!response.ok) {
      throw new Error(`Generation stopped without retry after HTTP ${response.status} for ${sample.fileName}.`);
    }

    const destination = path.join(outputDirectory, sample.fileName);
    const temporary = path.join(outputDirectory, `.${sample.fileName}.source.ogg`);
    await writeFile(temporary, Buffer.from(await response.arrayBuffer()));
    run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", temporary,
      "-map_metadata", "-1",
      "-codec", "copy",
      "-metadata", `title=${sample.title}`,
      "-metadata", `artist=${manifest.voiceName}`,
      "-metadata", `album=${manifest.title}`,
      "-metadata", `comment=Voice ID: ${manifest.voiceId} | Model: ${manifest.modelId} | Seed: ${sample.seed}`,
      destination
    ]);
    await rm(temporary, { force: true });

    const details = probe(destination);
    const fileStats = await stat(destination);
    assert(fileStats.size > 1000, `Defective empty output: ${sample.fileName}.`);
    assert(details.codec === "opus" && details.sampleRate === 48000, `Unexpected encoding for ${sample.fileName}.`);
    assert(details.durationSeconds > 0.25 && details.durationSeconds < 15, `Unexpected duration for ${sample.fileName}.`);
    results.push({
      order: sample.order,
      fileName: sample.fileName,
      title: sample.title,
      text: sample.text,
      seed: sample.seed,
      voiceId: manifest.voiceId,
      modelId: manifest.modelId,
      requestId: response.headers.get("request-id") ?? response.headers.get("x-request-id"),
      ...details
    });
  }

  await writeFile(path.join(outputDirectory, "generation.json"), `${JSON.stringify({
    schemaVersion: 1,
    generatedAt,
    manifest: "audio-production/namaste-endings.json",
    outputFormat: manifest.outputFormat,
    voiceSettings: manifest.voiceSettings,
    requestCount: results.length,
    automaticRetries: 0,
    results
  }, null, 2)}\n`, "utf8");
  console.log(`Completed: ${results.length} generated, 0 failed, 0 retries.`);
}

main().catch((error) => {
  console.error(`Namaste generation stopped: ${error.message}`);
  process.exitCode = 1;
});
