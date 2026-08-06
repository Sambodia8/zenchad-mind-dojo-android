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
  return result;
}

function probe(filePath) {
  const result = run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size,bit_rate:format_tags=title,album,artist,comment:stream=codec_type,codec_name,sample_rate,channels,bit_rate",
    "-of", "json",
    filePath
  ]);
  const data = JSON.parse(result.stdout);
  const stream = data.streams?.find((item) => item.codec_type === "audio") ?? {};
  return {
    durationSeconds: Number(data.format?.duration ?? 0),
    bytes: Number(data.format?.size ?? 0),
    codec: stream.codec_name ?? "unknown",
    sampleRate: Number(stream.sample_rate ?? 0),
    channels: Number(stream.channels ?? 0),
    bitRate: Number(stream.bit_rate ?? data.format?.bit_rate ?? 0),
    tags: data.format?.tags ?? {}
  };
}

function addMetadata(sourcePath, destinationPath, candidate, manifest) {
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", sourcePath,
    "-map_metadata", "-1",
    "-codec", "copy",
    "-metadata", `title=${candidate.meditationName}: ${candidate.story} — ${candidate.kind} ${candidate.variation}`,
    "-metadata", "artist=ElevenLabs",
    "-metadata", `album=${manifest.title}`,
    "-metadata", `comment=${candidate.modelId} | Offline audition candidate`,
    destinationPath
  ]);
}

function makeMusicLoop(sourcePath, destinationPath, candidate, manifest) {
  const crossfadeSeconds = 5;
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", sourcePath,
    "-i", sourcePath,
    "-filter_complex",
    `[0:a]atrim=start=${crossfadeSeconds}:end=${candidate.durationSeconds},asetpts=PTS-STARTPTS[body];` +
      `[1:a]atrim=start=0:end=${crossfadeSeconds},asetpts=PTS-STARTPTS[head];` +
      `[body][head]acrossfade=d=${crossfadeSeconds}:c1=tri:c2=tri[out]`,
    "-map", "[out]",
    "-c:a", "libopus",
    "-b:a", "192k",
    "-vbr", "on",
    "-ar", "48000",
    "-map_metadata", "-1",
    "-metadata", `title=${candidate.meditationName}: ${candidate.story} — music ${candidate.variation} loop`,
    "-metadata", "artist=ElevenLabs",
    "-metadata", `album=${manifest.title}`,
    "-metadata", `comment=${candidate.modelId} | Five-second wraparound crossfade | Offline audition candidate`,
    destinationPath
  ]);
}

function validate(manifest) {
  assert(manifest.schemaVersion === 1, "Unsupported manifest schema.");
  assert(manifest.approved === true, "Pilot manifest is not approved.");
  assert(manifest.outputFormat === "opus_48000_192", "Pilot must use opus_48000_192.");
  assert(Array.isArray(manifest.candidates), "Pilot candidates are missing.");
  assert(manifest.candidates.length === 16, "Pilot must contain exactly sixteen candidates.");
  assert(manifest.candidates.length <= manifest.maxGenerations, "Generation cap exceeded.");

  const outputDirectory = path.resolve(projectRoot, manifest.outputDirectory);
  assert(isInside(projectRoot, outputDirectory), "Output directory must stay inside the project.");

  const fileNames = new Set();
  let approvedCredits = 0;
  for (const candidate of manifest.candidates) {
    assert(["ambience", "music"].includes(candidate.kind), `Unknown kind for ${candidate.id}.`);
    assert(candidate.durationSeconds === (candidate.kind === "ambience" ? 30 : 60), `Unexpected duration for ${candidate.id}.`);
    assert(candidate.fileName.endsWith(".ogg") && path.basename(candidate.fileName) === candidate.fileName, `Unsafe output for ${candidate.id}.`);
    assert(!fileNames.has(candidate.fileName), `Duplicate output ${candidate.fileName}.`);
    fileNames.add(candidate.fileName);
    assert(typeof candidate.prompt === "string" && candidate.prompt.trim().length > 0, `Missing prompt for ${candidate.id}.`);
    assert(candidate.prompt.length <= (candidate.kind === "ambience" ? 450 : 4100), `Prompt too long for ${candidate.id}.`);
    assert(candidate.modelId === (candidate.kind === "ambience" ? "eleven_text_to_sound_v2" : "music_v2"), `Wrong model for ${candidate.id}.`);
    approvedCredits += candidate.durationSeconds * manifest.costPerSecond[candidate.kind];
  }
  assert(approvedCredits <= manifest.maxApprovedCredits, `Projected ${approvedCredits} credits exceed approved cap.`);
  return { outputDirectory, approvedCredits };
}

async function writeIndex(manifest, outputDirectory) {
  const rows = [];
  for (const candidate of manifest.candidates) {
    const destination = path.join(outputDirectory, candidate.fileName);
    if (!(await exists(destination))) continue;
    const details = probe(destination);
    rows.push(
      `| ${candidate.order} | ${candidate.meditationName} | ${candidate.kind} ${candidate.variation} | [${candidate.fileName}](./${candidate.fileName}) | ${details.durationSeconds.toFixed(3)} s | ${details.sampleRate} Hz | ${Math.round(details.bitRate / 1000)} kbps |`
    );
  }
  const text = [
    `# ${manifest.title}`,
    "",
    "These are offline audition files. They are not bundled into the app until Sam chooses a direction.",
    "",
    "| # | Meditation | Candidate | File | Duration | Sample rate | Average bitrate |",
    "|---:|---|---|---|---:|---:|---:|",
    ...rows,
    "",
    "Sound Effects candidates use ElevenLabs' native seamless-loop option. Music candidates are generated as one-minute instrumentals, then converted locally into fifty-five-second wraparound loops using a five-second crossfade. Source Music outputs are retained in `sources/`.",
    ""
  ].join("\n");
  await writeFile(path.join(outputDirectory, "README.md"), text, "utf8");
}

async function main() {
  const manifestArgument = argumentValue("--manifest");
  assert(manifestArgument, "Pass --manifest <path>.");
  const manifestPath = path.resolve(projectRoot, manifestArgument);
  assert(isInside(projectRoot, manifestPath), "Manifest must stay inside the project.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const { outputDirectory, approvedCredits } = validate(manifest);
  const kind = argumentValue("--kind");
  assert(["ambience", "music"].includes(kind), "Pass exactly one --kind ambience or --kind music.");
  const allSelected = manifest.candidates.filter((candidate) => candidate.kind === kind);
  assert(allSelected.length === 8, `Expected eight ${kind} candidates.`);
  const repairOrderValue = argumentValue("--repair-order");
  if (repairOrderValue !== undefined) {
    const repairOrder = Number(repairOrderValue);
    const candidate = allSelected.find((item) => item.order === repairOrder);
    assert(candidate?.kind === "music", "--repair-order must identify a Music candidate.");
    const sourcesDirectory = path.join(outputDirectory, "sources");
    const sourcePath = path.join(
      sourcesDirectory,
      candidate.fileName.replace("-loop.ogg", "-source.ogg")
    );
    assert(await exists(sourcePath), `Preserved source is missing for order ${repairOrder}.`);
    await mkdir(outputDirectory, { recursive: true });
    const destination = path.join(outputDirectory, candidate.fileName);
    makeMusicLoop(sourcePath, destination, candidate, manifest);
    const details = probe(destination);
    assert(details.codec === "opus" && details.sampleRate === 48000, "Repaired loop format is invalid.");
    assert(Math.abs(details.durationSeconds - 55) < 0.25, `Repaired loop duration is ${details.durationSeconds}.`);
    await writeIndex(manifest, outputDirectory);
    console.log(`Locally repaired order ${repairOrder} from its preserved source; no API request made.`);
    return;
  }
  const startOrder = Number(argumentValue("--start-order") ?? allSelected[0].order);
  assert(Number.isInteger(startOrder), "--start-order must be an integer.");
  const selected = allSelected.filter((candidate) => candidate.order >= startOrder);
  assert(selected.length > 0, `No ${kind} candidates remain at or after order ${startOrder}.`);
  const selectedCredits = selected.reduce(
    (sum, candidate) => sum + candidate.durationSeconds * manifest.costPerSecond[candidate.kind],
    0
  );

  console.log(`Manifest: ${path.relative(projectRoot, manifestPath)}`);
  console.log(`Approved pilot ceiling: ${approvedCredits} credits.`);
  console.log(`Selected batch: ${selected.length} ${kind} candidates, projected ${selectedCredits} credits.`);
  for (const candidate of selected) {
    console.log(`${candidate.order}. ${candidate.meditationName} | ${candidate.variation} | ${candidate.fileName}`);
  }
  if (!process.argv.includes("--generate")) {
    console.log("Dry run only. Add --generate to make this approved batch.");
    return;
  }

  for (const candidate of selected) {
    if (await exists(path.join(outputDirectory, candidate.fileName))) {
      throw new Error(`Refusing to overwrite ${candidate.fileName}.`);
    }
  }

  const apiKey = (await readFile(path.resolve(argumentValue("--key-file") ?? defaultKeyFile), "utf8")).trim();
  assert(apiKey.length > 0, "External ElevenLabs API key file is empty.");
  await mkdir(outputDirectory, { recursive: true });
  const sourcesDirectory = path.join(outputDirectory, "sources");
  await mkdir(sourcesDirectory, { recursive: true });

  const results = [];
  for (const candidate of selected) {
    console.log(`Generating ${candidate.order}: ${candidate.fileName}`);
    const endpoint = new URL(
      candidate.kind === "ambience"
        ? "https://api.elevenlabs.io/v1/sound-generation"
        : "https://api.elevenlabs.io/v1/music"
    );
    endpoint.searchParams.set("output_format", manifest.outputFormat);
    const body = candidate.kind === "ambience"
      ? {
          text: candidate.prompt,
          loop: true,
          duration_seconds: candidate.durationSeconds,
          prompt_influence: candidate.promptInfluence,
          model_id: candidate.modelId
        }
      : {
          prompt: candidate.prompt,
          music_length_ms: candidate.durationSeconds * 1000,
          model_id: candidate.modelId,
          force_instrumental: true
        };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1200);
      throw new Error(`HTTP ${response.status} for ${candidate.fileName}; stopped without retry. ${detail}`);
    }

    const sourceName = candidate.kind === "music"
      ? candidate.fileName.replace("-loop.ogg", "-source.ogg")
      : `.${candidate.fileName}.source.ogg`;
    const sourcePath = candidate.kind === "music"
      ? path.join(sourcesDirectory, sourceName)
      : path.join(outputDirectory, sourceName);
    await writeFile(sourcePath, Buffer.from(await response.arrayBuffer()));
    const sourceProbe = probe(sourcePath);
    assert(sourceProbe.codec === "opus", `${candidate.fileName} source is not Opus.`);
    assert(sourceProbe.sampleRate === 48000, `${candidate.fileName} source is not 48 kHz.`);
    assert(Math.abs(sourceProbe.durationSeconds - candidate.durationSeconds) < 0.25, `${candidate.fileName} source duration is ${sourceProbe.durationSeconds}.`);

    const destination = path.join(outputDirectory, candidate.fileName);
    if (candidate.kind === "music") {
      makeMusicLoop(sourcePath, destination, candidate, manifest);
    } else {
      addMetadata(sourcePath, destination, candidate, manifest);
      await rm(sourcePath, { force: true });
    }
    const finalStats = await stat(destination);
    const finalProbe = probe(destination);
    assert(finalProbe.codec === "opus", `${candidate.fileName} is not Opus.`);
    assert(finalProbe.sampleRate === 48000, `${candidate.fileName} is not 48 kHz.`);
    const targetDuration = candidate.kind === "music" ? 55 : 30;
    assert(Math.abs(finalProbe.durationSeconds - targetDuration) < 0.25, `${candidate.fileName} final duration is ${finalProbe.durationSeconds}.`);
    results.push({
      order: candidate.order,
      id: candidate.id,
      fileName: candidate.fileName,
      meditationId: candidate.meditationId,
      kind: candidate.kind,
      variation: candidate.variation,
      modelId: candidate.modelId,
      requestId: response.headers.get("request-id") ?? response.headers.get("x-request-id"),
      songId: response.headers.get("song-id"),
      reportedCreditCost: Number(response.headers.get("character-cost") ?? 0) || null,
      projectedCreditCost: candidate.durationSeconds * manifest.costPerSecond[candidate.kind],
      bytes: finalStats.size,
      source: sourceProbe,
      final: finalProbe
    });
  }

  const consolidatedResults = [];
  for (const candidate of allSelected) {
    const destination = path.join(outputDirectory, candidate.fileName);
    if (!(await exists(destination))) continue;
    const currentResult = results.find((item) => item.order === candidate.order);
    if (currentResult) {
      consolidatedResults.push(currentResult);
      continue;
    }
    const finalStats = await stat(destination);
    const sourcePath = candidate.kind === "music"
      ? path.join(
          outputDirectory,
          "sources",
          candidate.fileName.replace("-loop.ogg", "-source.ogg")
        )
      : null;
    consolidatedResults.push({
      order: candidate.order,
      id: candidate.id,
      fileName: candidate.fileName,
      meditationId: candidate.meditationId,
      kind: candidate.kind,
      variation: candidate.variation,
      modelId: candidate.modelId,
      requestId: null,
      songId: null,
      reportedCreditCost: null,
      projectedCreditCost: candidate.durationSeconds * manifest.costPerSecond[candidate.kind],
      bytes: finalStats.size,
      source: sourcePath && await exists(sourcePath) ? probe(sourcePath) : null,
      final: probe(destination),
      recoveredFromExistingArtifacts: true
    });
  }

  const metadata = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    manifest: path.relative(projectRoot, manifestPath).replaceAll("\\", "/"),
    kind,
    projectedCreditCost: selectedCredits,
    paidRequestsThisRun: results.length,
    completedCandidateCount: consolidatedResults.length,
    automaticRetries: 0,
    results: consolidatedResults
  };
  await writeFile(
    path.join(outputDirectory, `generation-${kind}.json`),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8"
  );
  await writeIndex(manifest, outputDirectory);
  console.log(`Completed ${results.length} ${kind} candidates, 0 retries.`);
}

main().catch((error) => {
  console.error(`Soundscape pilot stopped: ${error.message}`);
  process.exitCode = 1;
});
