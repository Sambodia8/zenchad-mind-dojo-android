import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
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
  try { await access(filePath); return true; } catch { return false; }
}

function probe(filePath) {
  const result = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration,size,bit_rate:stream=codec_type,codec_name,sample_rate,channels", "-of", "json", filePath], { windowsHide: true, encoding: "utf8" });
  if (result.status !== 0) throw new Error((result.stderr || "ffprobe failed").trim());
  const parsed = JSON.parse(result.stdout);
  const audio = parsed.streams?.find((stream) => stream.codec_type === "audio") ?? {};
  return {
    durationSeconds: Number(parsed.format?.duration ?? 0),
    bytes: Number(parsed.format?.size ?? 0),
    codec: audio.codec_name ?? "unknown",
    sampleRate: Number(audio.sample_rate ?? 0),
    channels: Number(audio.channels ?? 0),
    bitRate: Number(parsed.format?.bit_rate ?? 0)
  };
}

async function main() {
  const manifestArgument = argumentValue("--manifest");
  assert(manifestArgument, "Pass --manifest <path>.");
  const manifestPath = path.resolve(projectRoot, manifestArgument);
  assert(isInside(projectRoot, manifestPath), "Manifest must stay inside the project.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const outputDirectory = path.resolve(projectRoot, manifest.outputDirectory);
  assert(manifest.schemaVersion === 1 && manifest.approved === true, "Approved schema v1 manifest required.");
  assert(isInside(projectRoot, outputDirectory), "Output directory must stay inside the project.");
  assert(Array.isArray(manifest.lines) && manifest.lines.length > 0, "No voice lines configured.");
  assert(manifest.lines.length <= 70, "Voice generation cap exceeded.");
  for (const line of manifest.lines) {
    assert(/^[a-z0-9-]+$/.test(line.id), `Unsafe line id: ${line.id}`);
    assert(manifest.voices[line.voice]?.voiceId, `Unknown voice for ${line.id}`);
    assert(line.text.length > 0 && line.text.length <= 500, `Invalid text for ${line.id}`);
  }
  console.log(`Manifest: ${path.relative(projectRoot, manifestPath)}`);
  console.log(`Approved batch: ${manifest.lines.length} voice lines.`);
  console.log(`Mara: ${manifest.voices.mara.voiceId}; Pursuer: ${manifest.voices.pursuer.voiceId}`);
  if (!process.argv.includes("--generate")) {
    console.log("Dry run only. Add --generate to make the approved API calls.");
    return;
  }

  const shouldResume = process.argv.includes("--resume");
  for (const line of manifest.lines) {
    const destination = path.join(outputDirectory, `${line.id}.mp3`);
    if (!shouldResume && await exists(destination)) throw new Error(`Refusing to overwrite ${destination}.`);
  }
  const keyFile = path.resolve(argumentValue("--key-file") ?? defaultKeyFile);
  assert(!isInside(projectRoot, keyFile), "API key must remain outside the project.");
  const apiKey = (await readFile(keyFile, "utf8")).trim();
  assert(apiKey.length > 0, "External ElevenLabs API key file is empty.");
  await mkdir(outputDirectory, { recursive: true });

  const results = [];
  for (const line of manifest.lines) {
    const destination = path.join(outputDirectory, `${line.id}.mp3`);
    if (shouldResume && await exists(destination)) {
      results.push({ id: line.id, voice: line.voice, resumedExistingFile: true, final: await probe(destination) });
      continue;
    }
    console.log(`Generating ${line.id} (${line.voice})...`);
    const endpoint = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(manifest.voices[line.voice].voiceId)}`);
    endpoint.searchParams.set("output_format", manifest.outputFormat);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
      body: JSON.stringify({
        text: line.text,
        model_id: manifest.modelId,
        voice_settings: manifest.voiceSettings
      })
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1200);
      throw new Error(`HTTP ${response.status} for ${line.id}; stopped without retry. ${detail}`);
    }
    const source = path.join(outputDirectory, `.${line.id}.source.mp3`);
    await writeFile(source, Buffer.from(await response.arrayBuffer()));
    const final = path.join(outputDirectory, `${line.id}.mp3`);
    const result = spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-i", source,
      "-map_metadata", "-1", "-af", "loudnorm=I=-18:LRA=8:TP=-2",
      "-codec:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", "-ac", "1",
      "-id3v2_version", "3", "-metadata", `title=${line.id}`,
      "-metadata", "artist=ElevenLabs", "-metadata", `album=${manifest.title}`,
      "-metadata", `${"comment"}=${manifest.voices[line.voice].name} | ${manifest.modelId}`,
      final
    ], { cwd: projectRoot, encoding: "utf8", windowsHide: true });
    if (result.status !== 0) throw new Error(`ffmpeg failed for ${line.id}: ${(result.stderr || "").trim()}`);
    await rm(source, { force: true });
    const details = await probe(final);
    assert(details.codec === "mp3" && details.sampleRate === 44100 && details.channels === 1, `${line.id} failed normalization.`);
    results.push({
      id: line.id,
      voice: line.voice,
      voiceId: manifest.voices[line.voice].voiceId,
      requestId: response.headers.get("request-id") ?? response.headers.get("x-request-id"),
      characterCost: response.headers.get("character-cost"),
      final: details
    });
  }
  await writeFile(path.join(outputDirectory, "generation.json"), `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    manifest: path.relative(projectRoot, manifestPath).replaceAll("\\", "/"),
    requestCount: results.length,
    automaticRetries: 0,
    normalization: "loudnorm -18 LUFS, -2 dB true peak",
    results
  }, null, 2)}\n`, "utf8");
  console.log(`Completed ${results.length} voice lines with no automatic retries.`);
}

main().catch((error) => {
  console.error(`Running Story voice generation stopped: ${error.message}`);
  process.exitCode = 1;
});
