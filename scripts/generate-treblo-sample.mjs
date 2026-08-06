import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
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
    "-show_entries", "format=duration,size,bit_rate:stream=codec_type,codec_name,sample_rate,channels,bit_rate:stream_tags=title,artist,album,comment",
    "-of", "json",
    filePath
  ]);
  const data = JSON.parse(result.stdout);
  const audio = data.streams?.find((item) => item.codec_type === "audio") ?? {};
  return {
    durationSeconds: Number(data.format?.duration ?? 0),
    bytes: Number(data.format?.size ?? 0),
    bitRate: Number(audio.bit_rate ?? data.format?.bit_rate ?? 0),
    codec: audio.codec_name ?? "unknown",
    sampleRate: Number(audio.sample_rate ?? 0),
    channels: Number(audio.channels ?? 0),
    tags: audio.tags ?? {}
  };
}

function validate(manifest) {
  assert(manifest.schemaVersion === 1, "Unsupported manifest schema.");
  assert(manifest.approved === true, "Manifest is not approved.");
  assert(manifest.maxTaskSubmissions === 3, "This audition authorizes no more than three submitted tasks in total.");
  assert(manifest.maxSuccessfulGenerations === 2, "This audition authorizes exactly two successful samples in total.");
  assert(manifest.endpoint === "https://api.treblo.com/v1/generations/v3", "Unexpected Treblo endpoint.");
  assert(manifest.model === "melodia_v3", "Unexpected Treblo model.");
  assert(manifest.instrumental === true, "Sample must be instrumental.");
  assert(manifest.outputFormat === "ogg", "Sample must request Ogg.");
  assert(
    Array.isArray(manifest.lengthRangeSeconds) &&
      manifest.lengthRangeSeconds[0] === 60 &&
      manifest.lengthRangeSeconds[1] === 90,
    "Sample must request a valid sixty-to-ninety-second range."
  );
  assert(Array.isArray(manifest.tags) && manifest.tags.length > 0, "At least one supported Treblo tag is required.");
  assert(Array.isArray(manifest.negativeTags) && manifest.negativeTags.length > 0, "Negative tags are required.");
  assert(["port-blue", "original"].includes(manifest.promptVariant), "Unknown prompt variant.");
  assert(typeof manifest.prompt === "string" && manifest.prompt.length > 0, "Prompt is required.");
  if (manifest.promptVariant === "port-blue") {
    assert(manifest.prompt.startsWith("Port Blue."), "Port Blue prompt must begin with Port Blue.");
  } else {
    assert(!/port blue/i.test(manifest.prompt), "Original prompt must not contain Port Blue.");
  }
  assert(typeof manifest.fileName === "string" && manifest.fileName.endsWith(".ogg"), "Safe Ogg fileName is required.");
  assert(path.basename(manifest.fileName) === manifest.fileName, "fileName cannot contain directories.");
  const outputDirectory = path.resolve(projectRoot, manifest.outputDirectory);
  assert(inside(projectRoot, outputDirectory), "Output directory must stay inside the project.");
  return outputDirectory;
}

async function apiRequest(url, apiKey) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!response.ok) {
    throw new Error(`Treblo HTTP ${response.status}: ${(await response.text()).slice(0, 1000)}`);
  }
  return response;
}

async function creditBalance(apiKey) {
  const response = await apiRequest("https://api.treblo.com/v1/credits/balance", apiKey);
  return response.json();
}

function prepareLoop(sourcePath, destinationPath, sourceDuration, manifest) {
  const crossfadeSeconds = 5;
  const loopStartSeconds = 2;
  const outroTrimSeconds = 12;
  const bodyStartSeconds = loopStartSeconds + crossfadeSeconds;
  const loopEndSeconds = sourceDuration - outroTrimSeconds;
  assert(loopEndSeconds - bodyStartSeconds > crossfadeSeconds, "Treblo source is too short for safe outro removal.");
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", sourcePath,
    "-i", sourcePath,
    "-filter_complex",
    `[0:a]atrim=start=${bodyStartSeconds}:end=${loopEndSeconds},asetpts=PTS-STARTPTS[body];` +
      `[1:a]atrim=start=${loopStartSeconds}:end=${bodyStartSeconds},asetpts=PTS-STARTPTS[head];` +
      `[body][head]acrossfade=d=${crossfadeSeconds}:c1=tri:c2=tri[out]`,
    "-map", "[out]",
    "-c:a", "libopus",
    "-b:a", "192k",
    "-vbr", "on",
    "-ar", "48000",
    "-map_metadata", "-1",
    "-metadata", "title=Metta: Treblo ambient comparison loop",
    "-metadata", "artist=Treblo / Melodia v3",
    "-metadata", `album=${manifest.title}`,
    "-metadata", "comment=Generated outro removed | Five-second wraparound crossfade | Offline audition candidate",
    destinationPath
  ]);
}

async function main() {
  const manifestArgument = argumentValue("--manifest");
  assert(manifestArgument, "Pass --manifest <path>.");
  const manifestPath = path.resolve(projectRoot, manifestArgument);
  assert(inside(projectRoot, manifestPath), "Manifest must stay inside the project.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const outputDirectory = validate(manifest);
  const destination = path.join(outputDirectory, manifest.fileName);
  const possibleTaskPaths = Array.from(
    { length: manifest.maxTaskSubmissions },
    (_, index) => path.join(
      outputDirectory,
      index === 0 ? "treblo-task.json" : `treblo-task-${String(index + 1).padStart(2, "0")}.json`
    )
  );
  const existingTaskPaths = [];
  for (const candidate of possibleTaskPaths) {
    if (await exists(candidate)) existingTaskPaths.push(candidate);
  }

  console.log(`Manifest: ${path.relative(projectRoot, manifestPath)}`);
  console.log(`Task submissions used: ${existingTaskPaths.length}/${manifest.maxTaskSubmissions}`);
  console.log(`Prompt variant: ${manifest.promptVariant}`);
  console.log(`Tags: ${manifest.tags.join(", ")}`);
  console.log(`Output: ${path.relative(projectRoot, destination)}`);

  if (process.argv.includes("--generate")) {
    assert(existingTaskPaths.length < manifest.maxTaskSubmissions, "Approved Treblo task-submission limit reached.");
    assert(!(await exists(destination)), "Output already exists; refusing a second generation.");
    const taskPath = possibleTaskPaths[existingTaskPaths.length];
    const apiKey = (await readFile(manifest.apiKeyFile, "utf8")).trim();
    assert(apiKey.length > 0, "External Treblo API key file is empty.");
    await mkdir(outputDirectory, { recursive: true });
    const before = await creditBalance(apiKey);
    const response = await fetch(manifest.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tags: manifest.tags,
        negative_tags: manifest.negativeTags,
        prompt: manifest.prompt,
        instrumental: manifest.instrumental,
        length_range: manifest.lengthRangeSeconds,
        output_format: manifest.outputFormat
      })
    });
    if (!response.ok) {
      throw new Error(`Treblo generation failed without retry: HTTP ${response.status}: ${(await response.text()).slice(0, 1200)}`);
    }
    const submitted = await response.json();
    assert(typeof submitted.task_id === "string" && submitted.task_id.length > 0, "Treblo returned no task ID.");
    await writeFile(
      taskPath,
      `${JSON.stringify({
        schemaVersion: 1,
        submittedAt: new Date().toISOString(),
        manifest: path.relative(projectRoot, manifestPath).replaceAll("\\", "/"),
        taskId: submitted.task_id,
        creditsBefore: before,
        promptVariant: manifest.promptVariant,
        automaticRetries: 0
      }, null, 2)}\n`,
      "utf8"
    );
    console.log("Submitted exactly one Treblo generation; no retries.");
    return;
  }

  if (process.argv.includes("--poll")) {
    assert(existingTaskPaths.length > 0, "No submitted Treblo task exists.");
    const taskPath = existingTaskPaths.at(-1);
    const apiKey = (await readFile(manifest.apiKeyFile, "utf8")).trim();
    const task = JSON.parse(await readFile(taskPath, "utf8"));
    if (await exists(destination)) {
      const finalProbe = probe(destination);
      console.log(`Already downloaded and prepared: ${finalProbe.durationSeconds.toFixed(3)} seconds.`);
      return;
    }
    const statusResponse = await apiRequest(
      `https://api.treblo.com/v1/generations/status/${encodeURIComponent(task.taskId)}`,
      apiKey
    );
    const statusPayload = await statusResponse.json();
    const status = typeof statusPayload === "string" ? statusPayload : statusPayload.status;
    console.log(`Treblo status: ${status}`);
    if (status === "FAILURE") throw new Error("Treblo generation failed; no retry was made.");
    if (status !== "SUCCESS") return;

    const detailResponse = await apiRequest(
      `https://api.treblo.com/v1/generations/${encodeURIComponent(task.taskId)}`,
      apiKey
    );
    const details = await detailResponse.json();
    assert(Array.isArray(details.song_paths) && details.song_paths.length === 1, "Expected exactly one Treblo song URL.");
    const audioResponse = await fetch(details.song_paths[0]);
    assert(audioResponse.ok, `Treblo audio download failed: HTTP ${audioResponse.status}.`);
    const sourcesDirectory = path.join(outputDirectory, "sources");
    await mkdir(sourcesDirectory, { recursive: true });
    const sourcePath = path.join(sourcesDirectory, manifest.fileName.replace("-loop.ogg", "-source.ogg"));
    await writeFile(sourcePath, Buffer.from(await audioResponse.arrayBuffer()));
    const sourceProbe = probe(sourcePath);
    assert(sourceProbe.codec === "opus", "Treblo source is not Opus.");
    assert(sourceProbe.durationSeconds >= 30, `Treblo source is unexpectedly short: ${sourceProbe.durationSeconds}.`);
    prepareLoop(sourcePath, destination, sourceProbe.durationSeconds, manifest);
    const finalProbe = probe(destination);
    assert(finalProbe.codec === "opus", "Prepared loop is not Opus.");
    assert(finalProbe.sampleRate === 48000, "Prepared loop is not 48 kHz.");
    assert(Math.abs(finalProbe.durationSeconds - (sourceProbe.durationSeconds - 19)) < 0.25, "Prepared loop duration is invalid.");
    run("ffmpeg", ["-v", "error", "-i", destination, "-f", "null", "-"]);
    const after = await creditBalance(apiKey);
    const fileStats = await stat(destination);
    const metadata = {
      schemaVersion: 1,
      completedAt: new Date().toISOString(),
      manifest: path.relative(projectRoot, manifestPath).replaceAll("\\", "/"),
      taskId: task.taskId,
      modelVersion: details.model_version,
      tags: details.tags,
      requestedTags: manifest.tags,
      requestedNegativeTags: manifest.negativeTags,
      promptVariant: manifest.promptVariant,
      instrumental: manifest.instrumental,
      prompt: manifest.prompt,
      creditsBefore: task.creditsBefore,
      creditsAfter: after,
      automaticRetries: 0,
      source: sourceProbe,
      final: { ...finalProbe, bytes: fileStats.size }
    };
    await writeFile(
      path.join(outputDirectory, manifest.fileName.replace("-loop.ogg", "-generation.json")),
      `${JSON.stringify(metadata, null, 2)}\n`,
      "utf8"
    );
    console.log(`Downloaded and prepared ${manifest.fileName}; no retries.`);
    return;
  }

  console.log("Dry run only. Use --generate once, then --poll until the task completes.");
}

main().catch((error) => {
  console.error(`Treblo sample stopped: ${error.message}`);
  process.exitCode = 1;
});
