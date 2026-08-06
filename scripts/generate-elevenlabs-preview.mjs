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

function printUsage() {
  console.log(
    [
      "Generate an approved ElevenLabs preview manifest.",
      "",
      "Dry run:",
      "  npm run audio:preview -- --manifest audio-production/acceptance-30s.json",
      "",
      "Generate:",
      "  npm run audio:preview -- --manifest audio-production/acceptance-30s.json --generate",
      "",
      "Options:",
      `  --key-file <path>  Override the default external key file (${defaultKeyFile})`,
      "  --overwrite        Replace existing output files (never implied)",
      "  --help             Show this message"
    ].join("\n")
  );
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
    throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout;
}

function embedMp3Metadata(sourcePath, destinationPath, sample, manifest) {
  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    sourcePath,
    "-map_metadata",
    "-1",
    "-codec",
    "copy",
    "-id3v2_version",
    "3",
    "-metadata",
    `title=${sample.title}`,
    "-metadata",
    `artist=${sample.voiceName}`,
    "-metadata",
    `album=${manifest.title}`,
    "-metadata",
    `comment=Voice ID: ${sample.voiceId} | Model: ${sample.modelId}`,
    destinationPath
  ]);
}

function probeMp3(filePath) {
  const output = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration,bit_rate:stream=codec_type,codec_name,sample_rate,channels,bit_rate",
    "-of",
    "json",
    filePath
  ]);
  const probe = JSON.parse(output);
  const audio = probe.streams?.find((stream) => stream.codec_type === "audio") ?? {};
  return {
    durationSeconds: Number(probe.format?.duration ?? 0),
    codec: audio.codec_name ?? "unknown",
    sampleRate: Number(audio.sample_rate ?? 0),
    channels: Number(audio.channels ?? 0),
    bitRate: Number(audio.bit_rate ?? probe.format?.bit_rate ?? 0)
  };
}

function validateManifest(manifest, outputDirectory) {
  assert(manifest.schemaVersion === 1, "Unsupported or missing manifest schemaVersion.");
  assert(manifest.approved === true, "Manifest must be explicitly marked approved.");
  assert(typeof manifest.title === "string" && manifest.title.length > 0, "Manifest title is required.");
  assert(Number.isInteger(manifest.seed), "Manifest seed must be an integer.");
  assert(
    typeof manifest.outputFormat === "string" && manifest.outputFormat.startsWith("mp3_"),
    "This preview generator currently requires an MP3 output format."
  );
  assert(
    Number.isInteger(manifest.maxGenerations) && manifest.maxGenerations > 0,
    "Manifest maxGenerations must be a positive integer."
  );
  assert(Array.isArray(manifest.samples) && manifest.samples.length > 0, "Manifest samples are required.");
  assert(
    manifest.samples.length <= manifest.maxGenerations,
    `Manifest contains ${manifest.samples.length} samples but approves at most ${manifest.maxGenerations}.`
  );
  assert(isPathInside(projectRoot, outputDirectory), "Output directory must stay inside the project.");

  const fileNames = new Set();
  let totalCharacters = 0;
  for (const sample of manifest.samples) {
    assert(typeof sample.voiceId === "string" && sample.voiceId.length > 0, "Every sample needs a voiceId.");
    assert(typeof sample.voiceName === "string" && sample.voiceName.length > 0, "Every sample needs a voiceName.");
    assert(typeof sample.modelId === "string" && sample.modelId.length > 0, "Every sample needs a modelId.");
    assert(typeof sample.fileName === "string" && sample.fileName.endsWith(".mp3"), "Every output must be an MP3.");
    assert(path.basename(sample.fileName) === sample.fileName, "Output fileName cannot contain directories.");
    assert(!fileNames.has(sample.fileName), `Duplicate output fileName: ${sample.fileName}`);
    fileNames.add(sample.fileName);

    const text = manifest.textByModel?.[sample.modelId] ?? manifest.spokenText;
    assert(typeof text === "string" && text.trim().length > 0, `No text configured for ${sample.modelId}.`);
    assert(text.length <= 5000, `Text for ${sample.modelId} exceeds the 5,000-character safety limit.`);
    totalCharacters += text.length;
  }

  assert(
    totalCharacters <= manifest.maxApprovedCharacters,
    `The manifest requests ${totalCharacters} characters, exceeding its approved limit of ${manifest.maxApprovedCharacters}.`
  );
  return totalCharacters;
}

function buildIndex(manifest, generatedAt, results, failures) {
  const settings = manifest.voiceSettings;
  const rows = results.map(
    (result) =>
      `| ${result.order} | [${result.fileName}](./${result.fileName}) | ${result.voiceName} | \`${result.voiceId}\` | \`${result.modelId}\` | ${result.durationSeconds.toFixed(3)} s | ${result.sampleRate} Hz | ${Math.round(result.bitRate / 1000)} kbps |`
  );
  const failedRows = failures.map(
    (failure) =>
      `- **${failure.fileName}** — ${failure.voiceName} / \`${failure.modelId}\`: HTTP ${failure.status}`
  );

  return [
    `# ${manifest.title}`,
    "",
    `Generated: ${generatedAt}`,
    "",
    "| # | File | Voice | Voice ID | Model | Duration | Sample rate | Bitrate |",
    "|---:|---|---|---|---|---:|---:|---:|",
    ...rows,
    "",
    "## Shared request settings",
    "",
    `- Output format: \`${manifest.outputFormat}\``,
    `- Seed: \`${manifest.seed}\``,
    `- Stability: \`${settings.stability}\``,
    `- Similarity boost: \`${settings.similarity_boost}\``,
    `- Style: \`${settings.style}\``,
    `- Speaker boost: \`${settings.use_speaker_boost}\``,
    `- Speed: \`${settings.speed}\``,
    "- Requests made: one per listed voice/model combination; no automatic retries.",
    ...(failedRows.length ? ["", "## Failed requests", "", ...failedRows] : []),
    ""
  ].join("\n");
}

async function main() {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }

  const manifestArgument = argumentValue("--manifest");
  assert(manifestArgument, "Pass --manifest <path>. Use --help for examples.");

  const manifestPath = path.resolve(projectRoot, manifestArgument);
  assert(isPathInside(projectRoot, manifestPath), "Manifest must stay inside the project.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const outputDirectory = path.resolve(projectRoot, manifest.outputDirectory);
  const totalCharacters = validateManifest(manifest, outputDirectory);
  const shouldGenerate = process.argv.includes("--generate");
  const shouldOverwrite = process.argv.includes("--overwrite");

  console.log(`Manifest: ${path.relative(projectRoot, manifestPath)}`);
  console.log(`Approved requests: ${manifest.samples.length}`);
  console.log(`Approved characters: ${totalCharacters} / ${manifest.maxApprovedCharacters}`);
  for (const sample of manifest.samples) {
    console.log(`${sample.order}. ${sample.voiceName} | ${sample.modelId} | ${sample.fileName}`);
  }

  if (!shouldGenerate) {
    console.log("Dry run only. Add --generate to make the approved API calls.");
    return;
  }

  for (const sample of manifest.samples) {
    const destination = path.join(outputDirectory, sample.fileName);
    if (!shouldOverwrite && (await fileExists(destination))) {
      throw new Error(`Refusing to overwrite existing output: ${destination}`);
    }
  }

  const keyFile = path.resolve(argumentValue("--key-file") ?? defaultKeyFile);
  const apiKey = (await readFile(keyFile, "utf8")).trim();
  assert(apiKey.length > 0, "The external ElevenLabs API key file is empty.");
  await mkdir(outputDirectory, { recursive: true });

  const generatedAt = new Date().toISOString();
  const results = [];
  const failures = [];

  for (const sample of manifest.samples) {
    const text = manifest.textByModel?.[sample.modelId] ?? manifest.spokenText;
    const endpoint = new URL(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(sample.voiceId)}`
    );
    endpoint.searchParams.set("output_format", manifest.outputFormat);

    console.log(`Generating ${sample.order}/${manifest.samples.length}: ${sample.fileName}`);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey
      },
      body: JSON.stringify({
        text,
        model_id: sample.modelId,
        seed: manifest.seed,
        voice_settings: manifest.voiceSettings
      })
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1000);
      failures.push({
        order: sample.order,
        fileName: sample.fileName,
        voiceName: sample.voiceName,
        voiceId: sample.voiceId,
        modelId: sample.modelId,
        status: response.status,
        detail
      });
      console.error(`Request failed without retry: HTTP ${response.status} for ${sample.fileName}`);
      if (response.status === 401 || response.status === 403) break;
      continue;
    }

    const destination = path.join(outputDirectory, sample.fileName);
    const temporary = path.join(outputDirectory, `.${sample.fileName}.source.mp3`);
    await writeFile(temporary, Buffer.from(await response.arrayBuffer()));
    embedMp3Metadata(temporary, destination, sample, manifest);
    await rm(temporary, { force: true });

    const fileStats = await stat(destination);
    const probe = probeMp3(destination);
    results.push({
      order: sample.order,
      fileName: sample.fileName,
      voiceName: sample.voiceName,
      voiceId: sample.voiceId,
      modelId: sample.modelId,
      requestId: response.headers.get("request-id") ?? response.headers.get("x-request-id"),
      bytes: fileStats.size,
      ...probe
    });
  }

  const metadata = {
    schemaVersion: 1,
    generatedAt,
    manifest: path.relative(projectRoot, manifestPath).replaceAll("\\", "/"),
    outputFormat: manifest.outputFormat,
    seed: manifest.seed,
    voiceSettings: manifest.voiceSettings,
    requestCount: results.length + failures.length,
    automaticRetries: 0,
    results,
    failures
  };
  await writeFile(
    path.join(outputDirectory, "generation.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(outputDirectory, "README.md"),
    buildIndex(manifest, generatedAt, results, failures),
    "utf8"
  );

  console.log(`Completed: ${results.length} generated, ${failures.length} failed, 0 retries.`);
  if (failures.length > 0 || results.length !== manifest.samples.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Audio preview generation stopped: ${error.message}`);
  process.exitCode = 1;
});
