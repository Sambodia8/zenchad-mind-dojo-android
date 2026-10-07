import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "audio-production", "eleven-v4-revoice");
const sourceIndexes = [
  "audio-production/catalogue/catalogue-index.json",
  "audio-production/variants/catalogue-index.json",
  "audio-production/fourth-variants/catalogue-index.json"
];
const extraSourceManifests = [
  { path: "audio-production/acceptance-10m-opus-192.json", appAudioId: "acceptance-v4-qda-v3" }
];
const voiceId = "zFkVchYwoYAFyxBrr2oH";
const voiceName = "Adam soothing owls";
const profile = "user-authorized-eleven-v4-revoice";
const deliveryCue = "[soft, slow, warm voice] ";
const generationDate = "2026-10-06";

// Reviewed against each scene, rather than inferred from keywords such as
// "bell" (a jellyfish shape) or "applause" (an audience that has already left).
// Each entry is [segment index, required scene text, clearly auditory cue].
// Quiet effects occur only at selected moments, leaving breath counts, most
// body scans, safety instructions, and the final return to the room clear.
const sceneSoundCues = {
  "acceptance-v2-story-qda-v3": [[0, "museum after closing", "[quiet museum room ambience]"]],
  "acceptance-v3-story-qda-v3": [
    [0, "slow river", "[gentle river flowing]"],
    [10, "river continue", "[faint river flowing]"]
  ],
  "acceptance-v4-qda-v3": [
    [2, "sleeping harbour", "[soft distant waves lapping]"],
    [3, "drizzle", "[gentle rain pattering]"],
    [10, "dark reservoir", "[faint water lapping]"]
  ],
  "acceptance-v4-story-qda-v3": [[0, "repair shop open at midnight", "[quiet workshop room ambience]"]],
  "ajna-v1-qda-v3": [
    [2, "quiet inner sea", "[soft distant waves lapping]"],
    [8, "plenty of ocean", "[faint distant waves lapping]"]
  ],
  "ajna-v3-qda-v3": [[1, "house surrounded by snow", "[soft distant winter wind]"]],
  "ajna-v4-qda-v3": [[0, "small planetarium", "[quiet planetarium ventilation hum]"]],
  "diaphragmatic-breathing-v1-qda-v3": [[6, "underground garden", "[faint leaves rustling]"]],
  "diaphragmatic-breathing-v3-qda-v3": [[2, "cave beside the sea", "[gentle waves lapping]"]],
  "diaphragmatic-breathing-v4-qda-v3": [[0, "calm blue water", "[faint water movement]"]],
  "ego-v2-qda-v3": [
    [0, "walking through a museum", "[quiet museum room ambience]"],
    [3, "old coat", "[soft fabric rustling]"]
  ],
  "ego-v3-qda-v3": [[0, "quiet archive", "[quiet archive room ambience]"]],
  "ego-v4-qda-v3": [[0, "theatre after the audience has gone home", "[quiet empty theatre room ambience]"]],
  "focused-attention-v2-qda-v3": [[2, "moth circling through the dark", "[faint night breeze rustling]"]],
  "grounding-v2-qda-v3": [
    [0, "calm campsite after dark", "[soft wind rustling tent fabric]"],
    [3, "clothing", "[soft fabric rustling]"]
  ],
  "grounding-v3-qda-v3": [
    [0, "small kitchen just before sunrise", "[quiet kitchen appliance hum]"],
    [3, "fabric", "[soft fabric rustling]"]
  ],
  "grounding-v4-qda-v3": [[3, "fabric on skin", "[soft fabric rustling]"]],
  "metta-v1-qda-v3": [[8, "distant hills", "[faint evening wind]"]],
  "metta-v2-qda-v3": [
    [3, "small envelope", "[soft paper rustling]"],
    [4, "gardens", "[faint wind rustling leaves]"]
  ],
  "metta-v3-qda-v3": [
    [0, "moonlit canal", "[gentle canal water lapping]"],
    [3, "Fold another boat", "[soft paper folding]"],
    [9, "canal widening into a river", "[faint river flowing]"]
  ],
  "metta-v4-qda-v3": [[0, "weather station", "[soft evening wind]"]],
  "nsdr-v2-qda-v3": [[0, "last train of the evening", "[faint distant train rumble]"]],
  "nsdr-v3-qda-v3": [
    [1, "seaside hotel", "[soft distant waves lapping]"],
    [2, "Curtains close softly", "[soft curtain fabric rustling]"],
    [9, "surf beyond the hotel windows", "[faint distant surf]"]
  ],
  "nsdr-v4-qda-v3": [
    [0, "observatory", "[quiet observatory room ambience]"],
    [3, "quiet, dependable click", "[soft mechanical click]"],
    [11, "dawn gathers", "[quiet distant dawn birdsong]"]
  ],
  "pratyahara-v1-qda-v3": [[0, "quiet craft", "[quiet cabin ventilation hum]"]],
  "pratyahara-v2-qda-v3": [[0, "quiet station beneath a blue ocean", "[quiet underwater station ventilation hum]"]],
  "pratyahara-v3-qda-v3": [
    [0, "library just after closing", "[quiet library room ambience]"],
    [1, "books being returned", "[soft distant book rustling]"]
  ],
  "pratyahara-v4-qda-v3": [[0, "garden", "[faint night wind rustling leaves]"]],
  "sound-awareness-v1-qda-v3": [[4, "fabric", "[soft fabric rustling]"]],
  "sound-awareness-v2-qda-v3": [
    [0, "night forest", "[soft wind rustling forest leaves]"],
    [4, "fabric", "[soft fabric rustling]"]
  ],
  "sound-awareness-v3-qda-v3": [
    [0, "roof of rain", "[gentle rain pattering on a roof]"],
    [2, "a bird", "[quiet distant birdsong]"]
  ],
  "sound-awareness-v4-qda-v3": [
    [0, "dark harbour at night", "[soft harbour water lapping]"],
    [3, "fabric", "[soft fabric rustling]"]
  ],
  "trataka-v1-qda-v3": [[9, "quiet room", "[quiet room ambience]"]],
  "trataka-v2-qda-v3": [[1, "field of snow", "[soft distant winter wind]"]],
  "trataka-v3-qda-v3": [[1, "quiet spacecraft", "[quiet spacecraft ventilation hum]"]],
  "trataka-v4-qda-v3": [[2, "quiet crystal cave", "[faint cave air sounds]"]],
  "urge-surfing-v1-qda-v3": [[4, "midnight pier", "[gentle waves beneath a pier]"]],
  "urge-surfing-v3-qda-v3": [
    [0, "train in the distance", "[faint distant train rumble]"],
    [7, "first sign of departure", "[soft distant train rumble fading]"]
  ],
  "yoga-nidra-v1-qda-v3": [
    [1, "moonlit greenhouse", "[faint greenhouse leaves rustling]"],
    [16, "greenhouse roof", "[faint leaves rustling]"]
  ],
  "yoga-nidra-v2-qda-v3": [[0, "sleep deck of a starship", "[quiet starship ventilation hum]"]],
  "yoga-nidra-v3-qda-v3": [
    [1, "coverings", "[soft blanket fabric rustling]"],
    [9, "cabin stove", "[gentle stove fire crackling]"]
  ],
  "yoga-nidra-v4-qda-v3": [[0, "moonlit aquarium", "[quiet aquarium water bubbling]"]]
};

function prepareSegments(source, targetId) {
  const cues = sceneSoundCues[targetId] || [];
  const bySegment = new Map();
  for (const [index, anchor, cue] of cues) {
    if (!source.segments[index]?.text.includes(anchor)) {
      throw new Error(`Sound cue scene changed in ${targetId}, segment ${index + 1}: ${anchor}`);
    }
    if (bySegment.has(index)) throw new Error(`Duplicate sound cue in ${targetId}, segment ${index + 1}.`);
    bySegment.set(index, cue);
  }
  return source.segments.map((segment, index) => {
    const cue = bySegment.get(index);
    const text = deliveryCue + (cue ? `${cue} ` : "") + segment.text;
    if (text.length > 5000) throw new Error(`Tagged segment exceeds 5,000 characters in ${targetId}, segment ${index + 1}.`);
    return { ...segment, text };
  });
}

const sources = [];
for (const indexPath of sourceIndexes) {
  const index = JSON.parse(await readFile(path.join(root, indexPath), "utf8"));
  for (const relativeManifest of index.manifests) {
    const source = JSON.parse(await readFile(path.join(root, relativeManifest), "utf8"));
    if (source.approved !== true) throw new Error(`Source manifest is not approved: ${relativeManifest}`);
    const sourceCharacters = source.segments.reduce((sum, segment) => sum + segment.text.length, 0);
    sources.push({ relativeManifest, source, sourceCharacters });
  }
}
for (const { path: relativeManifest, appAudioId } of extraSourceManifests) {
  const source = JSON.parse(await readFile(path.join(root, relativeManifest), "utf8"));
  if (source.approved !== true) throw new Error(`Source manifest is not approved: ${relativeManifest}`);
  const retimedStarts = [15, 45, 80, 125, 170, 220, 270, 315, 375, 420, 465, 510, 550, 575];
  if (source.segments.length !== retimedStarts.length) throw new Error(`Unexpected Acceptance cue count in ${relativeManifest}.`);
  source.segments = source.segments.map((segment, index) => ({ ...segment, startSeconds: retimedStarts[index] }));
  source.openingSilenceSeconds = 15;
  source.closingSilenceSeconds = 10;
  const sourceCharacters = source.segments.reduce((sum, segment) => sum + segment.text.length, 0);
  sources.push({ relativeManifest, source, sourceCharacters, appAudioId });
}

const fourthVariants = sources.filter(({ relativeManifest }) => relativeManifest.includes("/fourth-variants/"));
const firstBatch = fourthVariants
  .slice()
  .sort((a, b) => a.sourceCharacters - b.sourceCharacters)
  .filter((entry, index, sorted) => sorted.findIndex((other) => other.source.meditationId === entry.source.meditationId) === index)
  .slice(0, 10);
const selectedIds = new Set(firstBatch.map(({ source }) => source.id));
const remainder = sources
  .filter(({ source }) => !selectedIds.has(source.id))
  .sort((a, b) => a.sourceCharacters - b.sourceCharacters);
const ordered = [...firstBatch, ...remainder];

if (sources.length !== 52) throw new Error(`Expected 52 approved app narration manifests; found ${sources.length}.`);
await mkdir(outputDirectory, { recursive: true });

const batchCount = Math.ceil(ordered.length / 10);
const batchIndexes = [];
for (let offset = 0; offset < ordered.length; offset += 10) {
  const batchNumber = String(Math.floor(offset / 10) + 1).padStart(2, "0");
  const manifests = [];
  const batch = ordered.slice(offset, offset + 10);

  for (const { relativeManifest, source, appAudioId } of batch) {
    const targetId = appAudioId || source.id;
    const id = `${targetId}-eleven-v4-zfk`;
    const segments = prepareSegments(source, targetId);
    const manifest = {
      ...source,
      id,
      approved: true,
      approvedBy: "Sam",
      approvalReference: `User-authorized Eleven v4 narration revoice, ${generationDate}`,
      generationProfile: profile,
      sourceManifest: relativeManifest,
      sourceId: source.id,
      targetAppAudioId: targetId,
      sourceVoiceId: source.voiceId,
      sourceModelId: source.modelId,
      voiceName,
      voiceId,
      modelId: "eleven_v4",
      scriptRevision: `${source.scriptRevision}-eleven-v4-zfk-${generationDate}`,
      outputPath: `output/eleven-v4-revoice/generated/${id}.ogg`,
      maxApprovedCharacters: segments.reduce((sum, segment) => sum + segment.text.length, 0),
      segments
    };
    const fileName = `${id}.json`;
    await writeFile(path.join(outputDirectory, fileName), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    manifests.push(`audio-production/eleven-v4-revoice/${fileName}`);
  }

  const indexPath = `audio-production/eleven-v4-revoice/batch-${batchNumber}-index.json`;
  await writeFile(
    path.join(root, indexPath),
    `${JSON.stringify({ schemaVersion: 1, batchNumber: Number(batchNumber), manifests }, null, 2)}\n`,
    "utf8"
  );
  batchIndexes.push({ batchNumber: Number(batchNumber), indexPath, tracks: batch.length, characters: batch.reduce((sum, row) => sum + prepareSegments(row.source, row.appAudioId || row.source.id).reduce((total, segment) => total + segment.text.length, 0), 0) });
}

await writeFile(
  path.join(outputDirectory, "README.md"),
  [
    "# Eleven v4 meditation revoice",
    "",
    `User-authorized on ${generationDate} for voice ${voiceName} (${voiceId}) with model eleven_v4.`,
    `Every timed cue starts with ${deliveryCue.trim()} so each independently generated segment carries the requested delivery direction.`,
    "Selected scene moments also include gentle, clearly auditory square-bracket sound cues: rain, water, wind, birdsong, fabric, paper, or quiet indoor ambience. Existing emotion and delivery tags are retained.",
    "Sound cues are matched to the actual imagery, kept sparse during breath counts and body scans, and omitted where the image has no suitable sound. No loud or startling effects are requested.",
    "The preparation script records each sound cue with its segment index and scene text, and stops if a future source edit changes that scene. Character approvals and batch totals include all tags; every segment stays within the timed generator's 5,000-character limit.",
    "Prompting reference: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices#prompting-eleven-v4 . These custom environmental tags follow the documented syntax; their audible rendering still needs checking with the selected voice during regeneration.",
    "Original script text, timing, output settings, and voice settings are retained from each approved source manifest.",
    "All final audio must be regenerated from these updated prompts. Existing generated cues and reports describe the earlier prompts and must not be reused as evidence of sound-cue rendering.",
    "Generated audio is staged under ignored output/eleven-v4-revoice/generated/; app assets are replaced only after all batches pass verification.",
    "",
    "## Batches",
    "",
    ...batchIndexes.map((batch) => `- Batch ${batch.batchNumber}: ${batch.tracks} tracks, ${batch.characters} characters; ${batch.indexPath}`),
    "",
    `Total source manifests: ${sources.length}. Batches: ${batchCount}. Automatic retries are disabled by the timed generator.`,
    ""
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify({ tracks: sources.length, firstBatch: batchIndexes[0], batches: batchIndexes }, null, 2));
