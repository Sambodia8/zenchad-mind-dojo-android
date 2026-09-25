import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultManifest = "audio-production/soundscape-long-form-music.json";

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function inside(base, candidate) {
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
    throw new Error(command + " failed: " + (result.stderr || result.stdout || "").trim());
  }
  return result.stdout ?? "";
}

function probe(filePath) {
  const data = JSON.parse(run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size:stream=codec_type,codec_name,sample_rate,channels",
    "-of", "json",
    filePath
  ]));
  const audio = data.streams?.find((stream) => stream.codec_type === "audio") ?? {};
  return {
    durationSeconds: Number(data.format?.duration ?? 0),
    bytes: Number(data.format?.size ?? 0),
    codec: audio.codec_name ?? "unknown",
    sampleRate: Number(audio.sample_rate ?? 0),
    channels: Number(audio.channels ?? 0)
  };
}

function validateShape(manifest) {
  assert(manifest.schemaVersion === 1, "Unsupported long-form music manifest schema.");
  assert(
    ["music-generation-dry-run", "music-generation-approved-pilot", "music-generation-pilot-complete"].includes(manifest.manifestKind),
    "Manifest is not a supported long-form music production manifest."
  );
  assert(manifest.provider === "ElevenLabs", "Unexpected music provider.");
  assert(manifest.endpoint === "https://api.elevenlabs.io/v1/music", "Unexpected Music API endpoint.");
  assert(manifest.model === "music_v2_5", "The long-form generator requires Music v2.5.");
  assert(manifest.requestedOutputFormat === "opus_48000_192", "Unexpected source output format.");
  assert(manifest.durationSeconds === 300, "Long-form music must be five minutes.");
  assert(manifest.forceInstrumental === true, "Long-form music must be instrumental.");
  assert(manifest.targetPackaging?.codec === "opus", "Packaging must target Opus.");
  assert(manifest.targetPackaging?.container === "ogg", "Packaging must target Ogg.");
  assert(manifest.targetPackaging?.sampleRate === 48000, "Packaging must target 48 kHz.");
  assert(manifest.targetPackaging?.channels === 2, "Packaging must target stereo.");
  assert(manifest.targetPackaging?.targetBitRateKbps === 80, "Packaging must target 80 kbps.");
  assert(manifest.automaticRetries === 0, "Automatic retries are not allowed.");
  assert(Array.isArray(manifest.candidates) && manifest.candidates.length === 26, "The manifest must contain 26 C/D candidates.");
}

function selectedCandidates(manifest, pilotOnly) {
  const candidates = pilotOnly
    ? manifest.candidates.filter((candidate) => candidate.pilot === true)
    : manifest.candidates;
  assert(candidates.length === (pilotOnly ? 6 : 26), pilotOnly
    ? "Pilot mode requires exactly six candidates."
    : "Full mode requires all 26 candidates.");
  return candidates;
}

function resolveProjectPath(relativePath, description) {
  const resolved = path.resolve(projectRoot, relativePath);
  assert(inside(projectRoot, resolved), description + " must stay inside the project.");
  return resolved;
}

async function assertNoOverwrite(candidates) {
  const paths = [];
  for (const candidate of candidates) {
    const sourcePath = resolveProjectPath(candidate.sourcePath, "Source output");
    const packagedPath = resolveProjectPath(candidate.packagedPath, "Packaged output");
    const metadataPath = resolveProjectPath(
      path.join(
        candidate.sourcePath.replace(/\\/g, "/").replace(/\/sources\/[^/]+$/, "/metadata"),
        candidate.fileName.replace(/\.ogg$/i, ".json")
      ),
      "Metadata output"
    );
    paths.push([candidate, sourcePath], [candidate, packagedPath], [candidate, metadataPath]);
  }
  for (const [candidate, filePath] of paths) {
    assert(!(await exists(filePath)), "Refusing to overwrite existing output for " + candidate.id + ": " + path.relative(projectRoot, filePath));
  }
}

function externalKeyPath(manifest) {
  const override = argumentValue("--api-key-file");
  const configured = override ?? manifest.apiKeyFile;
  assert(typeof configured === "string" && path.isAbsolute(configured), "Generation requires an external absolute API key path.");
  const resolved = path.resolve(configured);
  assert(!inside(projectRoot, resolved), "The ElevenLabs API key must remain outside the project.");
  return resolved;
}

async function readApiKey(manifest) {
  const keyPath = externalKeyPath(manifest);
  const apiKey = (await readFile(keyPath, "utf8")).trim();
  assert(apiKey.length > 0, "The external ElevenLabs API key file is empty.");
  return apiKey;
}

function validateGenerationGate(manifest, candidates) {
  assert(manifest.approved === true, "Refusing paid generation: manifest.approved must be true.");
  assert(manifest.generationEnabled === true, "Refusing paid generation: manifest.generationEnabled must be true.");
  assert(manifest.paidRequestsAllowed === true, "Refusing paid generation: manifest.paidRequestsAllowed must be true.");
  assert(manifest.approvalRequired === true, "The explicit approval gate is missing.");
  assert(manifest.maxApprovedCredits >= candidates.length * manifest.estimatedCreditsPerGeneration, "Approved credit cap is below the selected batch estimate.");
}

async function generateCandidate(candidate, manifest, apiKey) {
  const sourcePath = resolveProjectPath(candidate.sourcePath, "Source output");
  const packagedPath = resolveProjectPath(candidate.packagedPath, "Packaged output");
  const metadataPath = resolveProjectPath(
    path.join(
      candidate.sourcePath.replace(/\\/g, "/").replace(/\/sources\/[^/]+$/, "/metadata"),
      candidate.fileName.replace(/\.ogg$/i, ".json")
    ),
    "Metadata output"
  );
  await mkdir(path.dirname(sourcePath), { recursive: true });
  await mkdir(path.dirname(packagedPath), { recursive: true });
  await mkdir(path.dirname(metadataPath), { recursive: true });

  const endpoint = new URL(manifest.endpoint);
  endpoint.searchParams.set("output_format", manifest.requestedOutputFormat);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey
    },
    body: JSON.stringify({
      prompt: candidate.prompt,
      music_length_ms: manifest.durationSeconds * 1000,
      model_id: manifest.model,
      force_instrumental: manifest.forceInstrumental
    })
  });
  if (!response.ok) {
    throw new Error("ElevenLabs generation failed for " + candidate.id + " without retry: HTTP " + response.status + ": " + (await response.text()).slice(0, 1000));
  }

  const request = {
    requestId: response.headers.get("request-id") ?? response.headers.get("x-request-id"),
    songId: response.headers.get("song-id"),
    reportedCreditCost: Number(response.headers.get("character-cost") ?? 0) || null,
    automaticRetries: 0
  };
  await writeFile(sourcePath, Buffer.from(await response.arrayBuffer()), { flag: "wx" });
  const source = probe(sourcePath);
  assert(source.codec === "opus" && source.sampleRate === 48000 && source.channels === 2, "ElevenLabs returned an unexpected source format for " + candidate.id + ".");
  assert(Math.abs(source.durationSeconds - manifest.durationSeconds) < 0.5, "ElevenLabs returned an unexpected duration for " + candidate.id + ".");

  run("ffmpeg", [
    "-hide_banner",
    "-loglevel", "error",
    "-n",
    "-i", sourcePath,
    "-map", "0:a:0",
    "-c:a", "libopus",
    "-b:a", String(manifest.targetPackaging.targetBitRateKbps) + "k",
    "-ar", String(manifest.targetPackaging.sampleRate),
    "-ac", String(manifest.targetPackaging.channels),
    "-map_metadata", "-1",
    packagedPath
  ]);
  const packaged = probe(packagedPath);
  assert(packaged.codec === "opus" && packaged.sampleRate === 48000 && packaged.channels === 2, "Packaged output format is invalid for " + candidate.id + ".");
  assert(Math.abs(packaged.durationSeconds - manifest.durationSeconds) < 0.5, "Packaged output duration is invalid for " + candidate.id + ".");
  await writeFile(metadataPath, JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    provider: manifest.provider,
    model: manifest.model,
    candidateId: candidate.id,
    meditationId: candidate.meditationId,
    prompt: candidate.prompt,
    request,
    automaticRetries: 0,
    source,
    packaged
  }, null, 2) + "\n", { flag: "wx" });
  console.log("Generated " + candidate.id + " with one request and no retry.");
}

async function main() {
  const manifestArgument = argumentValue("--manifest") ?? defaultManifest;
  const manifestPath = path.resolve(projectRoot, manifestArgument);
  assert(inside(projectRoot, manifestPath), "Manifest must stay inside the project.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const pilotOnly = process.argv.includes("--pilot-only");
  const generate = process.argv.includes("--generate");
  validateShape(manifest);
  const candidates = selectedCandidates(manifest, pilotOnly);

  console.log("Manifest: " + path.relative(projectRoot, manifestPath));
  console.log("Mode: " + (pilotOnly ? "pilot-only" : "full batch") + (generate ? " generation" : " dry run"));
  console.log("Provider/model: " + manifest.provider + " / " + manifest.model);
  console.log("Candidates: " + candidates.length + " at " + manifest.durationSeconds + " seconds each.");
  for (const candidate of candidates) {
    console.log(candidate.order + ". " + candidate.meditationName + " / " + candidate.variation.toUpperCase() + " — " + candidate.id);
  }

  if (!generate) {
    console.log("Dry run only. No network request, API-key read, directory creation, or audio write was performed.");
    return;
  }

  validateGenerationGate(manifest, candidates);
  await assertNoOverwrite(candidates);
  const apiKey = await readApiKey(manifest);
  for (const candidate of candidates) {
    await generateCandidate(candidate, manifest, apiKey);
  }
  console.log("Completed " + candidates.length + " long-form music generations with zero automatic retries.");
}

main().catch((error) => {
  console.error("Long-form music generation stopped: " + error.message);
  process.exitCode = 1;
});
