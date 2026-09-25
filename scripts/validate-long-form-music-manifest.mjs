import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultManifest = "audio-production/soundscape-long-form-music.json";
const meditationIds = [
  "acceptance",
  "ajna",
  "diaphragmatic-breathing",
  "ego",
  "focused-attention",
  "grounding",
  "metta",
  "nsdr",
  "pratyahara",
  "sound-awareness",
  "trataka",
  "urge-surfing",
  "yoga-nidra"
];
const pilotMeditationIds = new Set(["metta", "sound-awareness", "yoga-nidra"]);

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

function sorted(values) {
  return [...values].sort();
}

async function main() {
  assert(!process.argv.includes("--generate"), "This manifest is a dry-run safety gate; paid generation is intentionally unavailable.");
  const manifestArgument = argumentValue("--manifest") ?? defaultManifest;
  const manifestPath = path.resolve(projectRoot, manifestArgument);
  assert(inside(projectRoot, manifestPath), "Manifest must stay inside the project.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  assert(manifest.schemaVersion === 1, "Unsupported long-form music manifest schema.");
  assert(["music-generation-dry-run", "music-generation-approved-pilot", "music-generation-pilot-complete"].includes(manifest.manifestKind), "Manifest is not a supported long-form music production state.");
  const approvedPilot = manifest.manifestKind === "music-generation-approved-pilot";
  const completedPilot = manifest.manifestKind === "music-generation-pilot-complete";
  const pilotAuthorized = approvedPilot || completedPilot;
  assert(manifest.approved === pilotAuthorized, "Manifest approval state does not match its kind.");
  assert(manifest.generationEnabled === approvedPilot, "Generation flag does not match the manifest approval state.");
  assert(manifest.paidRequestsAllowed === approvedPilot, "Paid-request flag does not match the manifest approval state.");
  assert(manifest.approvalRequired === true, "The approval gate is missing.");
  assert(manifest.provider === "ElevenLabs", "Unexpected music provider.");
  assert(manifest.endpoint === "https://api.elevenlabs.io/v1/music", "Unexpected Music API endpoint.");
  assert(manifest.model === "music_v2_5", "The long-form manifest must request Music v2.5.");
  assert(manifest.requestedOutputFormat === "opus_48000_192", "Use the supported Music API source format.");
  assert(manifest.durationSeconds === 300, "Every new track must request five minutes.");
  assert(manifest.forceInstrumental === true, "New tracks must be instrumental.");
  assert(manifest.tracksPerMeditation === 4, "The final catalogue must contain A/B/C/D.");
  assert(manifest.newVariations?.join(",") === "c,d", "New variations must be C and D.");
  assert(manifest.newTracksPerMeditation === 2, "Each style must receive exactly two new tracks.");
  assert(manifest.meditationStyleCount === meditationIds.length, "Meditation style count is stale.");
  assert(manifest.maxGenerations === 26, "The new batch must contain 26 candidates.");
  assert(
    pilotAuthorized
      ? manifest.maxApprovedCredits === manifest.pilot.trackCount * manifest.estimatedCreditsPerGeneration
      : manifest.maxApprovedCredits === 0,
    pilotAuthorized ? "Approved pilot credit cap must cover exactly six candidates." : "Unapproved work must have no approved credit cap."
  );
  assert(manifest.automaticRetries === 0, "Automatic retries must remain disabled.");
  assert(manifest.generationSafety?.dryRunNetworkCalls === 0, "Dry-run validation must not make network calls.");
  assert(manifest.generationSafety?.paidRequestsMade === (completedPilot ? 6 : 0), "Recorded paid requests do not match the production state.");
  assert(manifest.targetPackaging?.codec === "opus", "Packaging must target Opus.");
  assert(manifest.targetPackaging?.container === "ogg", "Packaging must target Ogg.");
  assert(manifest.targetPackaging?.sampleRate === 48000, "Packaging must target 48 kHz.");
  assert(manifest.targetPackaging?.channels === 2, "Music must remain stereo.");
  assert(manifest.targetPackaging?.targetBitRateKbps === 80, "Packaging target must be 80 kbps.");

  const candidates = manifest.candidates;
  assert(Array.isArray(candidates) && candidates.length === 26, "Exactly 26 C/D candidates are required.");
  const ids = new Set();
  const fileNames = new Set();
  const grouped = new Map();
  for (const [index, candidate] of candidates.entries()) {
    assert(candidate.order === index + 1, "Candidate " + candidate.id + " has the wrong order.");
    assert(typeof candidate.id === "string" && !ids.has(candidate.id), "Duplicate or missing candidate ID at " + (index + 1) + ".");
    ids.add(candidate.id);
    assert(meditationIds.includes(candidate.meditationId), "Unknown meditation " + candidate.meditationId + ".");
    assert(["c", "d"].includes(candidate.variation), "Invalid new variation for " + candidate.id + ".");
    assert(candidate.id === candidate.meditationId + "-music-" + candidate.variation + "-long-v1", "Unexpected ID for " + candidate.meditationId + ".");
    assert(candidate.provider === manifest.provider, "Provider mismatch for " + candidate.id + ".");
    assert(candidate.modelId === manifest.model, "Model mismatch for " + candidate.id + ".");
    assert(candidate.durationSeconds === manifest.durationSeconds, "Duration mismatch for " + candidate.id + ".");
    assert(candidate.targetBitRateKbps === manifest.targetPackaging.targetBitRateKbps, "Bitrate mismatch for " + candidate.id + ".");
    const candidateApproved = pilotAuthorized && candidate.pilot === true;
    assert(candidate.approved === candidateApproved, "Candidate approval state is inconsistent for " + candidate.id + ".");
    assert(candidate.fileName === candidate.meditationId + "-music-" + candidate.variation + ".ogg", "Unsafe output name for " + candidate.id + ".");
    assert(!fileNames.has(candidate.fileName), "Duplicate output name " + candidate.fileName + ".");
    fileNames.add(candidate.fileName);
    assert(candidate.sourcePath.startsWith(manifest.sourceDirectory + "/sources/"), "Source path escapes the dry-run source directory for " + candidate.id + ".");
    assert(candidate.packagedPath.startsWith(manifest.outputDirectory + "/"), "Packaged path escapes the output directory for " + candidate.id + ".");
    assert(typeof candidate.prompt === "string" && candidate.prompt.length >= 240, "Prompt is too short for " + candidate.id + ".");
    assert(!/port blue/i.test(candidate.prompt), "Rejected Port Blue direction appears in " + candidate.id + ".");

    const groupedCandidates = grouped.get(candidate.meditationId) ?? [];
    groupedCandidates.push(candidate);
    grouped.set(candidate.meditationId, groupedCandidates);
  }

  assert(grouped.size === meditationIds.length, "The C/D batch must cover all 13 meditation styles.");
  for (const meditationId of meditationIds) {
    const entries = grouped.get(meditationId) ?? [];
    assert(entries.length === 2, meditationId + " must have C and D.");
    assert(sorted(entries.map((entry) => entry.variation)).join(",") === "c,d", meditationId + " is missing C or D.");
    const expectedPilot = pilotMeditationIds.has(meditationId);
    for (const entry of entries) {
      assert(entry.pilot === expectedPilot, "Pilot designation is inconsistent for " + entry.id + ".");
      const expectedStatus = completedPilot && expectedPilot
        ? "pilot-generated"
        : approvedPilot && expectedPilot
          ? "pilot-approved"
        : expectedPilot
          ? "pilot-pending"
          : "deferred-pending";
      assert(entry.status === expectedStatus, "Unexpected status for " + entry.id + ".");
    }
  }

  const pilotCandidates = candidates.filter((candidate) => candidate.pilot);
  assert(pilotCandidates.length === manifest.pilot.trackCount && pilotCandidates.length === 6, "The pilot must contain six tracks.");
  assert(new Set(pilotCandidates.map((candidate) => candidate.meditationId)).size === manifest.pilot.styleCount, "The pilot must cover three styles.");
  assert(sorted([...new Set(pilotCandidates.map((candidate) => candidate.meditationId))]).join(",") === sorted(manifest.pilot.styles).join(","), "Pilot styles do not match the manifest.");
  assert(sorted(pilotCandidates.map((candidate) => candidate.id)).join(",") === sorted(manifest.pilot.candidateIds).join(","), "Pilot candidate IDs do not match the manifest.");

  console.log(JSON.stringify({
    manifest: path.relative(projectRoot, manifestPath),
    approved: manifest.approved,
    generationEnabled: manifest.generationEnabled,
    paidRequestsAllowed: manifest.paidRequestsAllowed,
    candidateCount: candidates.length,
    meditationStyleCount: grouped.size,
    durationSeconds: manifest.durationSeconds,
    newVariations: manifest.newVariations,
    pilotTrackCount: pilotCandidates.length,
    pilotStyles: sorted([...new Set(pilotCandidates.map((candidate) => candidate.meditationId))]),
    estimatedCreditsTotal: manifest.estimatedCreditsTotal,
    networkCalls: manifest.generationSafety.dryRunNetworkCalls,
    paidRequestsMade: manifest.generationSafety.paidRequestsMade
  }, null, 2));
  console.log(completedPilot
    ? "Long-form music pilot manifest validation passed; six generated tracks are recorded and paid generation is re-locked."
    : "Long-form music manifest validation passed; no audio was generated by this validation.");
}

main().catch((error) => {
  console.error("Long-form music manifest validation failed: " + error.message);
  process.exitCode = 1;
});
