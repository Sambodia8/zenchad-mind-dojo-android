import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function run(command, args, includeStderr = false) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return includeStderr ? `${result.stdout ?? ""}${result.stderr ?? ""}` : result.stdout;
}

function probe(filePath) {
  const data = JSON.parse(run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size,bit_rate:stream=codec_type,codec_name,sample_rate,channels,bit_rate",
    "-of", "json",
    filePath
  ]));
  const audio = data.streams?.find((stream) => stream.codec_type === "audio") ?? {};
  return {
    durationSeconds: Number(data.format?.duration ?? 0),
    bytes: Number(data.format?.size ?? 0),
    bitRate: Number(audio.bit_rate ?? data.format?.bit_rate ?? 0),
    codec: audio.codec_name ?? "unknown",
    sampleRate: Number(audio.sample_rate ?? 0),
    channels: Number(audio.channels ?? 0)
  };
}

function silenceEvents(filePath) {
  return run("ffmpeg", [
    "-hide_banner",
    "-i", filePath,
    "-af", "silencedetect=noise=-45dB:d=0.75",
    "-f", "null",
    "-"
  ], true)
    .split(/\r?\n/)
    .filter((line) => /silence_(start|end)/.test(line))
    .map((line) => line.trim());
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function main() {
  const manifestArgument = argumentValue("--manifest") ?? "audio-production/soundscape-catalogue.json";
  const manifestPath = path.resolve(projectRoot, manifestArgument);
  assert(inside(projectRoot, manifestPath), "Manifest must stay inside the project.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert(manifest.schemaVersion === 1 && manifest.approved === true, "Catalogue is not approved.");
  assert(Array.isArray(manifest.tracks) && manifest.tracks.length === 26, "Catalogue must contain exactly 26 tracks.");
  assert(manifest.tracksPerMeditation === 2, "Catalogue must contain two tracks per meditation.");

  const outputDirectory = path.resolve(projectRoot, manifest.outputDirectory);
  assert(inside(projectRoot, outputDirectory), "Output directory must stay inside the project.");
  const grouped = new Map();
  const fileNames = new Set();
  for (const track of manifest.tracks) {
    assert(["a", "b"].includes(track.variation), `Invalid variation for ${track.meditationId}.`);
    assert(["ElevenLabs", "Treblo"].includes(track.provider), `Invalid provider for ${track.meditationId}.`);
    assert(typeof track.title === "string" && track.title.length > 0, `Missing title for ${track.meditationId}.`);
    assert(track.fileName === path.basename(track.fileName) && track.fileName.endsWith(".ogg"), `Unsafe file name ${track.fileName}.`);
    assert(!fileNames.has(track.fileName), `Duplicate file name ${track.fileName}.`);
    fileNames.add(track.fileName);
    const source = path.resolve(projectRoot, track.source);
    assert(inside(projectRoot, source), `Source must stay inside the project for ${track.fileName}.`);
    assert(await exists(source), `Missing source ${track.source}.`);
    const entries = grouped.get(track.meditationId) ?? [];
    entries.push(track);
    grouped.set(track.meditationId, entries);
  }
  assert(grouped.size === 13, "Catalogue must cover exactly 13 meditation styles.");
  for (const [meditationId, tracks] of grouped) {
    assert(tracks.length === 2, `${meditationId} does not have exactly two tracks.`);
    assert(new Set(tracks.map((track) => track.variation)).size === 2, `${meditationId} is missing A or B.`);
  }

  console.log(`Verified manifest structure: ${manifest.tracks.length} tracks across ${grouped.size} meditation styles.`);
  if (!process.argv.includes("--copy")) {
    console.log("Dry run only. Add --copy to package and verify the approved offline catalogue.");
    return;
  }

  await mkdir(outputDirectory, { recursive: true });
  const results = [];
  for (const track of manifest.tracks) {
    const source = path.resolve(projectRoot, track.source);
    const destination = path.join(outputDirectory, track.fileName);
    const sourceHash = await sha256(source);
    if (await exists(destination)) {
      const destinationHash = await sha256(destination);
      if (destinationHash !== sourceHash) {
        assert(process.argv.includes("--refresh"), `Refusing to overwrite changed asset ${track.fileName} without --refresh.`);
        await copyFile(source, destination);
      }
    } else {
      await copyFile(source, destination);
    }
    const details = probe(destination);
    assert(details.codec === "opus", `${track.fileName} is not Opus.`);
    assert(details.sampleRate === 48000, `${track.fileName} is not 48 kHz.`);
    assert(details.channels === 2, `${track.fileName} is not stereo.`);
    assert(details.durationSeconds >= 35, `${track.fileName} is unexpectedly short.`);
    assert((await stat(destination)).size > 100_000, `${track.fileName} is unexpectedly small.`);
    run("ffmpeg", ["-v", "error", "-i", destination, "-f", "null", "-"]);
    results.push({
      ...track,
      src: `assets/audio/soundscapes/${track.fileName}`,
      sha256: sourceHash,
      ...details,
      silenceEvents: silenceEvents(destination)
    });
    console.log(`Packaged ${results.length}/26: ${track.fileName}`);
  }

  const appCatalogue = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    tracksPerMeditation: manifest.tracksPerMeditation,
    tracks: results.map((result) => ({
      meditationId: result.meditationId,
      variation: result.variation,
      title: result.title,
      provider: result.provider,
      src: result.src,
      durationSeconds: result.durationSeconds
    }))
  };
  await writeFile(path.join(outputDirectory, "catalogue.json"), `${JSON.stringify(appCatalogue, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(projectRoot, "audio-production", "soundscape-catalogue-verification.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      verifiedAt: new Date().toISOString(),
      trackCount: results.length,
      meditationCount: grouped.size,
      totalBytes: results.reduce((sum, result) => sum + result.bytes, 0),
      silenceEventCount: results.reduce((sum, result) => sum + result.silenceEvents.length, 0),
      results
    }, null, 2)}\n`,
    "utf8"
  );
  console.log(`Packaged and fully decoded ${results.length} offline soundscape tracks.`);
}

main().catch((error) => {
  console.error(`Soundscape catalogue preparation stopped: ${error.message}`);
  process.exitCode = 1;
});
