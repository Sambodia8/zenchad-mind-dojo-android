import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const sourcePath = path.resolve(
  projectRoot,
  argumentValue("--source") || "audio-production/base-catalogue.json"
);
const outputDirectory = path.resolve(
  projectRoot,
  argumentValue("--output-dir") || "audio-production/catalogue"
);
const source = JSON.parse(await readFile(sourcePath, "utf8"));

await mkdir(outputDirectory, { recursive: true });

const manifestPaths = [];
for (const [trackIndex, track] of source.tracks.entries()) {
  const manifest = {
    schemaVersion: 1,
    id: track.id,
    meditationId: track.meditationId,
    title: track.title,
    scriptRevision: track.scriptRevision,
    approved: source.guideApproved,
    approvedBy: source.approvedBy,
    sourceDraft: path.relative(
      projectRoot,
      path.join(outputDirectory, `${track.id}-draft.md`)
    ).replaceAll("\\", "/"),
    durationSeconds: track.durationSeconds,
    openingSilenceSeconds: source.defaults.openingSilenceSeconds,
    closingSilenceSeconds: source.defaults.closingSilenceSeconds,
    outputPath: `public/assets/audio/meditations/${track.outputFile}`,
    segmentOutputFormat: source.defaults.outputFormat,
    finalOutputFormat: source.defaults.outputFormat,
    voiceName: source.defaults.voiceName,
    voiceId: source.defaults.voiceId,
    modelId: source.defaults.modelId,
    seed: source.defaults.seed + trackIndex * 100,
    maxApprovedCharacters: source.defaults.maxCharactersPerTrack,
    voiceSettings: source.defaults.voiceSettings,
    segments: track.segments
  };

  const manifestName = `${track.id}.json`;
  const manifestPath = path.join(outputDirectory, manifestName);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  manifestPaths.push(path.relative(projectRoot, manifestPath).replaceAll("\\", "/"));

  const lines = [
    `# ${track.title}`,
    "",
    `- Meditation: ${track.meditationId}`,
    `- Duration: ${track.durationSeconds} seconds`,
    `- Opening silence: ${source.defaults.openingSilenceSeconds} seconds`,
    `- Creative direction: ${track.creativeDirection}`,
    `- Approval basis: ${source.approvalReference}`,
    ""
  ];
  for (const segment of track.segments) {
    const minutes = String(Math.floor(segment.startSeconds / 60)).padStart(2, "0");
    const seconds = String(segment.startSeconds % 60).padStart(2, "0");
    lines.push(`## ${minutes}:${seconds}`, "", segment.text, "");
  }
  await writeFile(
    path.join(outputDirectory, `${track.id}-draft.md`),
    lines.join("\n") + "\n",
    "utf8"
  );
}

await writeFile(
  path.join(outputDirectory, "catalogue-index.json"),
  JSON.stringify({ schemaVersion: 1, manifests: manifestPaths }, null, 2) + "\n",
  "utf8"
);

console.log(`Prepared ${manifestPaths.length} approved manifests and timed drafts from ${path.relative(projectRoot, sourcePath)}.`);
