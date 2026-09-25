/**
 * Rebuild the narrated-meditation catalogue from its existing cue metadata.
 *
 * This tool is deliberately offline: it never reads an API key or calls a
 * network service. It extracts the already-paid cues to an ignored masters
 * directory, lays them out again with a generated breathing clip, and emits
 * candidate assets outside public/. Packaging into public/ is opt-in and has
 * an additional guard.
 */
import { spawnSync } from "node:child_process";
import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.resolve(root, "audio-production/breathing-guidance-production.json");
const packagedNarrations = path.join(root, "public/assets/audio/meditations");
const retainedNarrationMasters = path.join(root, "output/audio-masters/pre-insertion-narrations");
const write = process.argv.includes("--write");
const replaceCandidates = process.argv.includes("--replace-candidates");
const replaceMasters = process.argv.includes("--replace-masters");
const allowPackagedOutput = process.argv.includes("--allow-packaged-output");

function value(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function projectPath(relative) {
  const absolute = path.resolve(root, relative);
  assert(absolute === root || absolute.startsWith(root + path.sep), `Path escapes project: ${relative}`);
  return absolute;
}
async function exists(file) { try { await access(file); return true; } catch { return false; } }
function run(command, args, stderr = false) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  return stderr ? `${result.stdout ?? ""}${result.stderr ?? ""}` : result.stdout;
}
function probe(file) {
  const result = JSON.parse(run("ffprobe", ["-v", "error", "-show_entries", "format=duration,size,bit_rate:stream=codec_type,codec_name,sample_rate,channels", "-of", "json", file]));
  const stream = result.streams?.find((item) => item.codec_type === "audio") ?? {};
  return { durationSeconds: Number(result.format?.duration), bytes: Number(result.format?.size), codec: stream.codec_name, sampleRate: Number(stream.sample_rate), channels: Number(stream.channels) };
}
function assertNarrationFormat(file, details) {
  assert(details.codec === "opus", `${path.basename(file)} must be Opus.`);
  assert(details.sampleRate === 48000 && details.channels === 1, `${path.basename(file)} must be 48 kHz mono.`);
}
function catalogueTracks(catalogue) {
  return catalogue.tracks.map((track) => ({
    id: track.id,
    meditationId: track.meditationId,
    durationSeconds: track.durationSeconds,
    fileName: track.outputFile
  }));
}
async function loadTracks() {
  const catalogues = await Promise.all([
    "audio-production/base-catalogue.json",
    "audio-production/variant-catalogue.json",
    "audio-production/fourth-variant-catalogue.json"
  ].map(async (file) => JSON.parse(await readFile(projectPath(file), "utf8"))));
  const tracks = catalogues.flatMap(catalogueTracks);
  tracks.push({ id: "acceptance-v4-qda-v3", meditationId: "acceptance", durationSeconds: 600, fileName: "acceptance-v4-qda-v3.ogg" });
  tracks.push({ id: "nsdr-protocol-v1-qda-v3", meditationId: "nsdr", durationSeconds: 600, fileName: "nsdr-protocol-v1-qda-v3.ogg", excludedFromBreathing: true });
  return tracks;
}
function metadataCues(metadata) {
  if (!Array.isArray(metadata.segments) || metadata.segments.length === 0) return [];
  return metadata.segments.map((segment) => ({ startSeconds: Number(segment.startSeconds), durationSeconds: Number(segment.durationSeconds) }));
}
function deriveCuesFromSilence(source, starts, targetDuration) {
  // A legacy retimed file may record cue starts but not individual durations.
  // Derive only the cue end from the following silence; this is auditable in
  // the output metadata and never changes the source audio.
  const output = run("ffmpeg", ["-hide_banner", "-i", source, "-af", "silencedetect=noise=-45dB:d=0.35", "-f", "null", "-"], true);
  const silenceStarts = [...output.matchAll(/silence_start:\s*([0-9.]+)/g)].map((match) => Number(match[1]));
  return starts.map((start, index) => {
    const next = starts[index + 1] ?? targetDuration - 8;
    const end = silenceStarts.find((time) => time > start + 0.35 && time < next) ?? next - 0.25;
    assert(end > start + 0.25, `Could not derive a spoken window after ${start}s in ${path.basename(source)}.`);
    return { startSeconds: start, durationSeconds: end - start, derived: true };
  });
}
function standardPlan(cues, clipDuration, targetDuration, trackId) {
  assert(cues.length >= 3, "Narration needs at least three spoken cues for early breathing insertion.");
  const opening = 15;
  const closing = 10;
  const minimumGap = 2;
  const itemCount = cues.length + 1;
  const gapCount = itemCount - 1;
  const totalSpeech = cues.reduce((sum, cue) => sum + cue.durationSeconds, 0) + clipDuration;
  const availableForGaps = targetDuration - opening - closing - totalSpeech;
  assert(
    availableForGaps >= gapCount * minimumGap,
    `${trackId} cannot fit its existing speech and ${clipDuration}s breathing clip without changing speech speed.`
  );
  const gap = availableForGaps / gapCount;
  const planned = [];
  let cursor = opening;
  for (const [index, cue] of cues.entries()) {
    planned.push({ ...cue, startSeconds: cursor });
    cursor += cue.durationSeconds + gap;
    if (index === 1) break;
  }
  const breathingStartSeconds = cursor;
  cursor += clipDuration + gap;
  for (const cue of cues.slice(2)) {
    planned.push({ ...cue, startSeconds: cursor });
    cursor += cue.durationSeconds + gap;
  }
  const last = planned.at(-1);
  assert(last.startSeconds + last.durationSeconds <= targetDuration - closing + 0.001, `${trackId} lost required closing silence.`);
  return { targetDuration, cues: planned, breathingStartSeconds, retimed: false, reflowed: true };
}
function retimedNsdrPlan(cues, clipDuration) {
  const targetDuration = 600;
  const opening = 15;
  const closing = 10;
  const minGap = 2;
  const firstGap = 4;
  const totalSpeech = cues.reduce((sum, cue) => sum + cue.durationSeconds, 0) + clipDuration;
  const minimum = opening + totalSpeech + firstGap * 2 + minGap * (cues.length - 2) + closing;
  assert(minimum <= targetDuration, `NSDR speech and breathing cannot fit in ${targetDuration}s without changing speech speed.`);
  const expandableGaps = cues.length; // cue 1→breath, breath→cue 2, and remaining cue boundaries
  const extraPerGap = (targetDuration - minimum) / expandableGaps;
  const planned = [];
  let cursor = opening;
  planned.push({ ...cues[0], startSeconds: cursor });
  cursor += cues[0].durationSeconds + firstGap + extraPerGap;
  const breathingStartSeconds = cursor;
  cursor += clipDuration + firstGap + extraPerGap;
  for (const cue of cues.slice(1)) {
    planned.push({ ...cue, startSeconds: cursor });
    cursor += cue.durationSeconds + minGap + extraPerGap;
  }
  const last = planned.at(-1);
  assert(last.startSeconds + last.durationSeconds <= targetDuration - closing + 0.001, "NSDR retiming lost required closing silence.");
  return { targetDuration, cues: planned, breathingStartSeconds, retimed: true };
}
function filterGraph(plan, cueCount) {
  const parts = [`[0:a]atrim=duration=${plan.targetDuration},asetpts=PTS-STARTPTS[base]`];
  const inputs = ["[base]"];
  for (let index = 0; index < cueCount; index += 1) {
    parts.push(`[${index + 1}:a]adelay=${Math.round(plan.cues[index].startSeconds * 1000)}:all=1[cue${index}]`);
    inputs.push(`[cue${index}]`);
  }
  parts.push(`[${cueCount + 1}:a]adelay=${Math.round(plan.breathingStartSeconds * 1000)}:all=1[breathing]`);
  inputs.push("[breathing]");
  parts.push(`${inputs.join("")}amix=inputs=${inputs.length}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[mix]`);
  return parts.join(";");
}
async function extractCueFiles(source, track, cues, masterRoot) {
  const cueDirectory = path.join(masterRoot, track.id, "cues");
  await mkdir(cueDirectory, { recursive: true });
  const output = [];
  for (const [index, cue] of cues.entries()) {
    const file = path.join(cueDirectory, `${String(index + 1).padStart(2, "0")}.wav`);
    if (await exists(file) && !replaceMasters) throw new Error(`Refusing to overwrite master cue ${file}; add --replace-masters after checking it.`);
    run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(cue.sourceStartSeconds), "-t", String(cue.durationSeconds), "-i", source, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", file]);
    output.push(file);
  }
  return output;
}
async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const sourceRootArgument = value("--source-root", undefined);
  const sourceRoot = sourceRootArgument
    ? projectPath(sourceRootArgument)
    : (await exists(retainedNarrationMasters) ? retainedNarrationMasters : packagedNarrations);
  assert(manifest.schemaVersion === 1 && Array.isArray(manifest.scripts) && manifest.scripts.length === 13, "Breathing manifest must contain exactly thirteen scripts.");
  const masterRoot = projectPath(value("--masters-dir", "output/audio-masters/meditation-cues"));
  const candidateRoot = projectPath(value("--output-dir", "output/audio-package-candidates/meditations"));
  const clipRoot = projectPath(value("--clip-dir", manifest.outputDirectory));
  const writingToPackagedAssets = candidateRoot === packagedNarrations;
  if (write && writingToPackagedAssets) assert(allowPackagedOutput && replaceCandidates, "Writing packaged narration requires --allow-packaged-output and --replace-candidates.");
  if (write) assert(manifest.approval?.approved === true, "Breathing scripts are drafts. Set approval.approved only after text and spend approval.");

  const tracks = await loadTracks();
  const scripts = new Map(manifest.scripts.map((script) => [script.id, script]));
  const scriptByMeditation = new Map(manifest.scripts.map((script) => [script.meditationId, script]));
  const plans = [];
  for (const track of tracks) {
    const source = path.join(sourceRoot, track.fileName);
    const metadataPath = `${source}.json`;
    assert(await exists(source) && await exists(metadataPath), `Missing source or metadata for ${track.id}.`);
    const sourceDetails = probe(source);
    assertNarrationFormat(source, sourceDetails);
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    const script = scriptByMeditation.get(track.meditationId);
    assert(script, `No breathing script for ${track.meditationId}.`);
    const excluded = track.excludedFromBreathing || (script.excludedNarrationIds ?? []).some((item) => item.id === track.id);
    let cues = metadataCues(metadata);
    if (cues.length === 0 && Array.isArray(metadata.cueStarts)) cues = deriveCuesFromSilence(source, metadata.cueStarts.map(Number), track.durationSeconds);
    assert(cues.length > 0, `${track.id} has no reusable cue timing metadata.`);
    const clip = path.join(clipRoot, script.fileName);
    const clipDuration = await exists(clip) ? probe(clip).durationSeconds : Number(script.estimatedDurationSeconds);
    if (await exists(clip)) assertNarrationFormat(clip, probe(clip));
    const sourceCues = cues.map((cue) => ({ ...cue, sourceStartSeconds: cue.startSeconds }));
    const plan = excluded
      ? { targetDuration: track.durationSeconds, cues: sourceCues, retimed: false, excluded: true }
      : track.meditationId === "nsdr"
        ? retimedNsdrPlan(sourceCues, clipDuration)
        : standardPlan(sourceCues, clipDuration, track.durationSeconds, track.id);
    plans.push({ id: track.id, meditationId: track.meditationId, source: path.relative(root, source).replaceAll("\\", "/"), output: path.relative(root, path.join(candidateRoot, track.fileName)).replaceAll("\\", "/"), breathingScriptId: script.id, breathingClip: path.relative(root, clip).replaceAll("\\", "/"), breathingClipPresent: await exists(clip), breathingClipDurationSeconds: clipDuration, ...plan });
  }
  const retimed = plans.filter((plan) => plan.retimed);
  assert(retimed.length === 4 && retimed.every((plan) => plan.targetDuration === 600), "Expected four restored NSDR journeys at exactly ten minutes.");
  const planFile = projectPath(value("--plan-output", "output/audio-production/breathing-narration-plan.json"));
  console.table(plans.map((plan) => ({ id: plan.id, mode: plan.excluded ? "reencode-only" : plan.retimed ? "retime+breathing" : "breathing", duration: plan.targetDuration, breathingAt: plan.breathingStartSeconds?.toFixed(2) ?? "—", clip: plan.breathingClipPresent ? "ready" : "missing" })));
  console.log(`Validated ${plans.length} source narrations; ${retimed.length} restored NSDR journeys; no API calls were made.`);
  if (!write) {
    console.log(`Dry run only. It would write masters to ${path.relative(root, masterRoot)} and candidates to ${path.relative(root, candidateRoot)} after --write.`);
    return;
  }
  assert(plans.filter((plan) => !plan.excluded).every((plan) => plan.breathingClipPresent), "Cannot write candidates until all thirteen approved breathing clips exist.");
  await mkdir(candidateRoot, { recursive: true });
  const outputRecords = [];
  for (const plan of plans) {
    const source = projectPath(plan.source);
    const destination = projectPath(plan.output);
    if (await exists(destination) && !replaceCandidates) throw new Error(`Refusing to overwrite candidate ${destination}; add --replace-candidates after review.`);
    if (plan.excluded) {
      run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", source, "-t", String(plan.targetDuration), "-ar", "48000", "-ac", "1", "-c:a", "libopus", "-b:a", "64k", "-vbr", "constrained", "-application", "audio", destination]);
    } else {
      const cueFiles = await extractCueFiles(source, plan, plan.cues.map((cue) => ({ ...cue, sourceStartSeconds: cue.sourceStartSeconds })), masterRoot);
      const clip = projectPath(plan.breathingClip);
      run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", ...cueFiles.flatMap((file) => ["-i", file]), "-i", clip, "-filter_complex", filterGraph(plan, cueFiles.length), "-map", "[mix]", "-t", String(plan.targetDuration), "-ar", "48000", "-ac", "1", "-c:a", "libopus", "-b:a", "64k", "-vbr", "constrained", "-application", "audio", destination]);
    }
    const details = probe(destination);
    assertNarrationFormat(destination, details);
    assert(Math.abs(details.durationSeconds - plan.targetDuration) < 0.05, `${plan.id} duration changed during rebuild.`);
    const record = { ...plan, paidApiCalls: 0, automaticRetries: 0, outputDetails: details };
    await writeFile(`${destination}.json`, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    outputRecords.push(record);
  }
  await mkdir(path.dirname(planFile), { recursive: true });
  await writeFile(planFile, `${JSON.stringify({ schemaVersion: 1, createdAt: new Date().toISOString(), paidApiCalls: 0, automaticRetries: 0, records: outputRecords }, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outputRecords.length} candidate narrations. Verify them before any package replacement.`);
}

main().catch((error) => { console.error(`Breathing narration preparation stopped: ${error.message}`); process.exitCode = 1; });
