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

function run(command, args, allowOutput = false) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return allowOutput ? `${result.stdout ?? ""}${result.stderr ?? ""}` : result.stdout;
}

function probe(filePath) {
  const data = JSON.parse(run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size,bit_rate:format_tags=title,artist,album,comment:stream=codec_type,codec_name,sample_rate,channels,bit_rate",
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
    channels: Number(audio.channels ?? 0),
    tags: data.format?.tags ?? {}
  };
}

function silenceEvents(filePath) {
  const output = run("ffmpeg", [
    "-hide_banner",
    "-i", filePath,
    "-af", "silencedetect=noise=-45dB:d=0.75",
    "-f", "null",
    "-"
  ], true);
  return output
    .split(/\r?\n/)
    .filter((line) => /silence_(start|end)/.test(line))
    .map((line) => line.trim());
}

function verifyDecode(filePath) {
  run("ffmpeg", ["-v", "error", "-i", filePath, "-f", "null", "-"]);
}

function prepareLoop(sourcePath, destinationPath, sourceDuration, candidate, manifest) {
  const {
    loopStartSeconds,
    crossfadeSeconds,
    outroTrimSeconds,
    targetBitRate,
    sampleRate
  } = manifest.loopPreparation;
  const bodyStart = loopStartSeconds + crossfadeSeconds;
  const loopEnd = candidate.loopEndSeconds ?? sourceDuration - outroTrimSeconds;
  assert(loopEnd - bodyStart > crossfadeSeconds, `${candidate.id} source is too short for safe loop preparation.`);

  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", sourcePath,
    "-i", sourcePath,
    "-filter_complex",
    `[0:a]atrim=start=${bodyStart}:end=${loopEnd},asetpts=PTS-STARTPTS[body];` +
      `[1:a]atrim=start=${loopStartSeconds}:end=${bodyStart},asetpts=PTS-STARTPTS[head];` +
      `[body][head]acrossfade=d=${crossfadeSeconds}:c1=tri:c2=tri[out]`,
    "-map", "[out]",
    "-c:a", "libopus",
    "-b:a", targetBitRate,
    "-vbr", "on",
    "-ar", String(sampleRate),
    "-map_metadata", "-1",
    "-metadata", `title=${candidate.meditationName}: ${candidate.story}`,
    "-metadata", `artist=${manifest.provider === "treblo" ? "Treblo" : "ElevenLabs"}`,
    "-metadata", `album=${manifest.title}`,
    "-metadata", `comment=${manifest.model} | Generated outro removed | ${crossfadeSeconds}-second wraparound crossfade | Offline production candidate`,
    destinationPath
  ]);

  const finalProbe = probe(destinationPath);
  const expectedDuration = loopEnd - loopStartSeconds - crossfadeSeconds;
  assert(finalProbe.codec === "opus", `${candidate.fileName} is not Opus.`);
  assert(finalProbe.sampleRate === sampleRate, `${candidate.fileName} has the wrong sample rate.`);
  assert(finalProbe.channels === 2, `${candidate.fileName} is not stereo.`);
  assert(Math.abs(finalProbe.durationSeconds - expectedDuration) < 0.25, `${candidate.fileName} has an invalid loop duration.`);
  verifyDecode(destinationPath);
  return finalProbe;
}

function validate(manifest) {
  assert(manifest.schemaVersion === 1, "Unsupported manifest schema.");
  assert(["treblo", "elevenlabs"].includes(manifest.provider), "Unknown soundscape provider.");
  assert(manifest.approved === true, "Soundscape manifest is not approved.");
  assert(Array.isArray(manifest.candidates) && manifest.candidates.length > 0, "Candidates are missing.");
  assert(manifest.candidates.length === manifest.maxGenerations, "Candidate count must equal the generation cap.");

  const outputDirectory = path.resolve(projectRoot, manifest.outputDirectory);
  assert(inside(projectRoot, outputDirectory), "Output directory must stay inside the project.");
  assert(path.isAbsolute(manifest.apiKeyFile), "API key file must be an external absolute path.");
  assert(!inside(projectRoot, manifest.apiKeyFile), "API key must remain outside the project.");

  const approvedCredits = manifest.provider === "treblo"
    ? manifest.maxGenerations * manifest.costPerGeneration
    : manifest.maxGenerations * manifest.estimatedCreditsPerGeneration;
  assert(approvedCredits === manifest.maxApprovedCredits, "Approved credit cap does not match the candidate cap.");

  const ids = new Set();
  const fileNames = new Set();
  for (const [index, candidate] of manifest.candidates.entries()) {
    assert(candidate.order === index + 1, `Unexpected order for ${candidate.id}.`);
    assert(typeof candidate.id === "string" && candidate.id.length > 0, "Candidate ID is required.");
    assert(!ids.has(candidate.id), `Duplicate candidate ID ${candidate.id}.`);
    ids.add(candidate.id);
    assert(typeof candidate.fileName === "string" && candidate.fileName.endsWith("-loop.ogg"), `Unsafe output for ${candidate.id}.`);
    assert(path.basename(candidate.fileName) === candidate.fileName, `Output for ${candidate.id} contains a directory.`);
    assert(!fileNames.has(candidate.fileName), `Duplicate output ${candidate.fileName}.`);
    fileNames.add(candidate.fileName);
    assert(typeof candidate.prompt === "string" && candidate.prompt.length >= 100, `Prompt is too short for ${candidate.id}.`);
    assert(!/port blue/i.test(candidate.prompt), `Port Blue must not appear in ${candidate.id}.`);
  }

  if (manifest.provider === "treblo") {
    assert(manifest.endpoint === "https://api.treblo.com/v1/generations/v3", "Unexpected Treblo endpoint.");
    assert(manifest.model === "melodia_v3", "Unexpected Treblo model.");
    assert(manifest.instrumental === true && manifest.outputFormat === "ogg", "Unexpected Treblo output settings.");
    assert(
      manifest.lengthRangeSeconds?.[0] === 60 && manifest.lengthRangeSeconds?.[1] === 90,
      "Treblo length range must be 60–90 seconds."
    );
    assert(Array.isArray(manifest.tags) && manifest.tags.length >= 3, "Treblo tags are missing.");
    assert(Array.isArray(manifest.negativeTags) && manifest.negativeTags.includes("jazz") && manifest.negativeTags.includes("brass"), "Treblo jazz/brass exclusions are missing.");
  } else {
    assert(manifest.endpoint === "https://api.elevenlabs.io/v1/music", "Unexpected ElevenLabs endpoint.");
    assert(manifest.model === "music_v2", "Unexpected ElevenLabs model.");
    assert(manifest.outputFormat === "opus_48000_192", "Unexpected ElevenLabs output format.");
    assert(manifest.durationSeconds === 60 && manifest.forceInstrumental === true, "Unexpected ElevenLabs music settings.");
  }

  return { outputDirectory, approvedCredits };
}

async function readApiKey(manifest) {
  const apiKey = (await readFile(manifest.apiKeyFile, "utf8")).trim();
  assert(apiKey.length > 0, `${manifest.provider} API key file is empty.`);
  return apiKey;
}

async function trebloRequest(url, apiKey) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!response.ok) {
    throw new Error(`Treblo HTTP ${response.status}: ${(await response.text()).slice(0, 1000)}`);
  }
  return response;
}

async function trebloBalance(apiKey) {
  const response = await trebloRequest("https://api.treblo.com/v1/credits/balance", apiKey);
  const payload = await response.json();
  return {
    included: Number(payload.num_credits ?? 0),
    payAsYouGo: Number(payload.num_credits_payg ?? 0)
  };
}

async function elevenLabsBalance(apiKey) {
  const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
    headers: { "xi-api-key": apiKey }
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs balance check failed: HTTP ${response.status}.`);
  }
  const payload = await response.json();
  return {
    characterLimit: Number(payload.character_limit ?? 0),
    characterCount: Number(payload.character_count ?? 0),
    remaining: Number(payload.character_limit ?? 0) - Number(payload.character_count ?? 0)
  };
}

async function download(url, destinationPath) {
  const response = await fetch(url);
  assert(response.ok, `Audio download failed: HTTP ${response.status}.`);
  await writeFile(destinationPath, Buffer.from(await response.arrayBuffer()));
}

async function pollTrebloTask(task, apiKey, candidate, failurePath) {
  let lastStatus = "";
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    const statusResponse = await trebloRequest(
      `https://api.treblo.com/v1/generations/status/${encodeURIComponent(task.taskId)}`,
      apiKey
    );
    const statusPayload = await statusResponse.json();
    const status = typeof statusPayload === "string" ? statusPayload : statusPayload.status;
    if (status !== lastStatus) {
      console.log(`${candidate.order}/${candidate.total}: ${candidate.meditationName} status ${status}`);
      lastStatus = status;
    }
    if (status === "FAILURE") {
      const balance = await trebloBalance(apiKey);
      await writeFile(failurePath, `${JSON.stringify({
        failedAt: new Date().toISOString(),
        candidateId: candidate.id,
        taskId: task.taskId,
        status,
        balance,
        automaticRetries: 0
      }, null, 2)}\n`, "utf8");
      throw new Error(`${candidate.meditationName} failed in Treblo; stopped with no retry.`);
    }
    if (status === "SUCCESS") return;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`${candidate.meditationName} polling timed out; task was not retried.`);
}

async function generateTrebloCandidate(candidate, manifest, directories, apiKey) {
  const { outputDirectory, sourcesDirectory, tasksDirectory, metadataDirectory } = directories;
  const destination = path.join(outputDirectory, candidate.fileName);
  const sourcePath = path.join(sourcesDirectory, candidate.fileName.replace("-loop.ogg", "-source.ogg"));
  const taskPath = path.join(tasksDirectory, `${String(candidate.order).padStart(2, "0")}-${candidate.id}.json`);
  const failurePath = path.join(tasksDirectory, `${String(candidate.order).padStart(2, "0")}-${candidate.id}-failure.json`);
  const metadataPath = path.join(metadataDirectory, candidate.fileName.replace("-loop.ogg", "-generation.json"));

  if (await exists(destination)) {
    console.log(`${candidate.order}/${candidate.total}: ${candidate.meditationName} already complete; skipping.`);
    return JSON.parse(await readFile(metadataPath, "utf8"));
  }
  assert(!(await exists(failurePath)), `${candidate.meditationName} has a recorded failure; refusing an automatic retry.`);

  let task;
  if (await exists(taskPath)) {
    task = JSON.parse(await readFile(taskPath, "utf8"));
    console.log(`${candidate.order}/${candidate.total}: resuming existing ${candidate.meditationName} task.`);
  } else if (!(await exists(sourcePath))) {
    const creditsBefore = await trebloBalance(apiKey);
    assert(creditsBefore.included + creditsBefore.payAsYouGo >= manifest.costPerGeneration, "Insufficient Treblo credits.");
    const response = await fetch(manifest.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tags: manifest.tags,
        negative_tags: manifest.negativeTags,
        prompt: candidate.prompt,
        instrumental: manifest.instrumental,
        length_range: manifest.lengthRangeSeconds,
        output_format: manifest.outputFormat
      })
    });
    if (!response.ok) {
      throw new Error(`Treblo submission failed for ${candidate.meditationName} without retry: HTTP ${response.status}: ${(await response.text()).slice(0, 1000)}`);
    }
    const payload = await response.json();
    assert(typeof payload.task_id === "string" && payload.task_id.length > 0, "Treblo returned no task ID.");
    task = {
      schemaVersion: 1,
      submittedAt: new Date().toISOString(),
      candidateId: candidate.id,
      taskId: payload.task_id,
      creditsBefore,
      automaticRetries: 0
    };
    await writeFile(taskPath, `${JSON.stringify(task, null, 2)}\n`, "utf8");
    console.log(`${candidate.order}/${candidate.total}: submitted ${candidate.meditationName}; no retries.`);
  }

  let details = null;
  if (!(await exists(sourcePath))) {
    await pollTrebloTask(task, apiKey, candidate, failurePath);
    const detailResponse = await trebloRequest(
      `https://api.treblo.com/v1/generations/${encodeURIComponent(task.taskId)}`,
      apiKey
    );
    details = await detailResponse.json();
    assert(Array.isArray(details.song_paths) && details.song_paths.length === 1 && details.song_paths[0], `Treblo returned no audio for ${candidate.meditationName}.`);
    await download(details.song_paths[0], sourcePath);
  }

  const sourceProbe = probe(sourcePath);
  assert(sourceProbe.codec === "opus" && sourceProbe.sampleRate === 48000, `${candidate.meditationName} source format is invalid.`);
  assert(sourceProbe.durationSeconds >= 30, `${candidate.meditationName} source is unexpectedly short.`);
  const finalProbe = prepareLoop(sourcePath, destination, sourceProbe.durationSeconds, candidate, manifest);
  const creditsAfter = await trebloBalance(apiKey);
  const metadata = {
    schemaVersion: 1,
    completedAt: new Date().toISOString(),
    provider: manifest.provider,
    model: manifest.model,
    candidateId: candidate.id,
    meditationName: candidate.meditationName,
    story: candidate.story,
    taskId: task?.taskId ?? null,
    prompt: candidate.prompt,
    requestedTags: manifest.tags,
    requestedNegativeTags: manifest.negativeTags,
    returnedTags: details?.tags ?? null,
    creditsBefore: task?.creditsBefore ?? null,
    creditsAfter,
    automaticRetries: 0,
    source: sourceProbe,
    final: finalProbe,
    silenceEvents: silenceEvents(destination)
  };
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  console.log(`${candidate.order}/${candidate.total}: completed ${candidate.meditationName} (${finalProbe.durationSeconds.toFixed(3)} s).`);
  return metadata;
}

async function generateElevenLabsCandidate(candidate, manifest, directories, apiKey) {
  const { outputDirectory, sourcesDirectory, metadataDirectory } = directories;
  const destination = path.join(outputDirectory, candidate.fileName);
  const sourcePath = path.join(sourcesDirectory, candidate.fileName.replace("-loop.ogg", "-source.ogg"));
  const metadataPath = path.join(metadataDirectory, candidate.fileName.replace("-loop.ogg", "-generation.json"));

  if (await exists(destination)) {
    console.log(`${candidate.order}/${candidate.total}: ${candidate.meditationName} already complete; skipping.`);
    return JSON.parse(await readFile(metadataPath, "utf8"));
  }

  let request = null;
  if (!(await exists(sourcePath))) {
    const creditsBefore = await elevenLabsBalance(apiKey);
    assert(creditsBefore.remaining >= manifest.estimatedCreditsPerGeneration, "Insufficient ElevenLabs credits.");
    const endpoint = new URL(manifest.endpoint);
    endpoint.searchParams.set("output_format", manifest.outputFormat);
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
      throw new Error(`ElevenLabs generation failed for ${candidate.meditationName} without retry: HTTP ${response.status}: ${(await response.text()).slice(0, 1000)}`);
    }
    request = {
      requestId: response.headers.get("request-id") ?? response.headers.get("x-request-id"),
      songId: response.headers.get("song-id"),
      reportedCreditCost: Number(response.headers.get("character-cost") ?? 0) || null,
      creditsBefore
    };
    await writeFile(sourcePath, Buffer.from(await response.arrayBuffer()));
    console.log(`${candidate.order}/${candidate.total}: generated ${candidate.meditationName}; no retries.`);
  }

  const sourceProbe = probe(sourcePath);
  assert(sourceProbe.codec === "opus" && sourceProbe.sampleRate === 48000, `${candidate.meditationName} source format is invalid.`);
  assert(Math.abs(sourceProbe.durationSeconds - manifest.durationSeconds) < 0.25, `${candidate.meditationName} source duration is invalid.`);
  const finalProbe = prepareLoop(sourcePath, destination, sourceProbe.durationSeconds, candidate, manifest);
  const creditsAfter = await elevenLabsBalance(apiKey);
  const metadata = {
    schemaVersion: 1,
    completedAt: new Date().toISOString(),
    provider: manifest.provider,
    model: manifest.model,
    candidateId: candidate.id,
    meditationName: candidate.meditationName,
    story: candidate.story,
    prompt: candidate.prompt,
    request,
    creditsAfter,
    automaticRetries: 0,
    source: sourceProbe,
    final: finalProbe,
    silenceEvents: silenceEvents(destination)
  };
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  console.log(`${candidate.order}/${candidate.total}: completed ${candidate.meditationName} (${finalProbe.durationSeconds.toFixed(3)} s).`);
  return metadata;
}

async function writeIndex(manifest, outputDirectory, results) {
  const rows = results.map((result, index) => {
    const candidate = manifest.candidates[index];
    return `| ${candidate.order} | ${candidate.meditationName} | ${candidate.story} | [${candidate.fileName}](./${candidate.fileName}) | ${result.final.durationSeconds.toFixed(3)} s | ${(result.final.bytes / 1024 / 1024).toFixed(2)} MiB | ${result.silenceEvents.length} |`;
  });
  const text = [
    `# ${manifest.title}`,
    "",
    "Offline production candidates generated during development. API credentials are never bundled.",
    "",
    "| # | Meditation | Theme | File | Loop duration | Size | Silence events |",
    "|---:|---|---|---|---:|---:|---:|",
    ...rows,
    "",
    `All loops are 48 kHz stereo Ogg Opus. The generated outro is removed before a ${manifest.loopPreparation.crossfadeSeconds}-second wraparound crossfade.`,
    ""
  ].join("\n");
  await writeFile(path.join(outputDirectory, "README.md"), text, "utf8");
  await writeFile(path.join(outputDirectory, "generation-index.json"), `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    provider: manifest.provider,
    model: manifest.model,
    candidateCount: results.length,
    automaticRetries: 0,
    results
  }, null, 2)}\n`, "utf8");
}

async function main() {
  const manifestArgument = argumentValue("--manifest");
  assert(manifestArgument, "Pass --manifest <path>.");
  const manifestPath = path.resolve(projectRoot, manifestArgument);
  assert(inside(projectRoot, manifestPath), "Manifest must stay inside the project.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const { outputDirectory, approvedCredits } = validate(manifest);
  const repairId = argumentValue("--repair-id");

  console.log(`Manifest: ${path.relative(projectRoot, manifestPath)}`);
  console.log(`Provider: ${manifest.provider}`);
  console.log(`Approved cap: ${manifest.maxGenerations} generations / ${approvedCredits} credits.`);
  for (const candidate of manifest.candidates) {
    console.log(`${candidate.order}. ${candidate.meditationName} — ${candidate.story} — ${candidate.fileName}`);
  }
  if (!process.argv.includes("--generate")) {
    if (repairId) {
      const candidate = manifest.candidates.find((item) => item.id === repairId);
      assert(candidate, `Unknown repair candidate ${repairId}.`);
      assert(Number.isFinite(candidate.loopEndSeconds), `${candidate.id} has no approved loop-end override.`);
      const sourcePath = path.join(
        outputDirectory,
        "sources",
        candidate.fileName.replace("-loop.ogg", "-source.ogg")
      );
      const destination = path.join(outputDirectory, candidate.fileName);
      const metadataPath = path.join(
        outputDirectory,
        "metadata",
        candidate.fileName.replace("-loop.ogg", "-generation.json")
      );
      assert(await exists(sourcePath), `Preserved source is missing for ${candidate.id}.`);
      assert(await exists(metadataPath), `Generation metadata is missing for ${candidate.id}.`);
      await mkdir(outputDirectory, { recursive: true });
      const sourceProbe = probe(sourcePath);
      const finalProbe = prepareLoop(sourcePath, destination, sourceProbe.durationSeconds, candidate, manifest);
      const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
      metadata.final = finalProbe;
      metadata.silenceEvents = silenceEvents(destination);
      metadata.locallyRepairedAt = new Date().toISOString();
      metadata.localRepair = {
        loopEndSeconds: candidate.loopEndSeconds,
        paidRequests: 0
      };
      await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
      console.log(`Locally repaired ${candidate.meditationName} at ${candidate.loopEndSeconds} seconds; no API request made.`);
      return;
    }
    console.log("Dry run only. Add --generate to execute this approved zero-retry batch.");
    return;
  }

  const apiKey = await readApiKey(manifest);
  const directories = {
    outputDirectory,
    sourcesDirectory: path.join(outputDirectory, "sources"),
    tasksDirectory: path.join(outputDirectory, "tasks"),
    metadataDirectory: path.join(outputDirectory, "metadata")
  };
  await Promise.all(Object.values(directories).map((directory) => mkdir(directory, { recursive: true })));

  const results = [];
  for (const originalCandidate of manifest.candidates) {
    const candidate = { ...originalCandidate, total: manifest.candidates.length };
    const result = manifest.provider === "treblo"
      ? await generateTrebloCandidate(candidate, manifest, directories, apiKey)
      : await generateElevenLabsCandidate(candidate, manifest, directories, apiKey);
    results.push(result);
  }
  await writeIndex(manifest, outputDirectory, results);
  console.log(`Completed ${results.length}/${manifest.candidates.length} ${manifest.provider} production candidates with zero retries.`);
}

main().catch((error) => {
  console.error(`Soundscape production stopped: ${error.message}`);
  process.exitCode = 1;
});
