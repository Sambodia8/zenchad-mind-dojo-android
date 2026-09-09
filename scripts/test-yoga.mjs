import assert from "node:assert/strict";
import {
  FULL_HOUSE_ELIGIBLE_IDS,
  FULL_HOUSE_EXCLUDED_IDS,
  MARKS_FLOW_IDS,
  MOVEMENTS,
  SUN_SALUTATION_IDS,
  YOGA_CLASSES,
  expandYogaClassSlides,
  getYogaClass,
  getYogaClassDuration,
  validateYogaClasses
} from "../src/data.ts";
import fs from "node:fs";

const fullHouse = getYogaClass("full-house");
assert.equal(fullHouse.id, "full-house");
assert.equal(FULL_HOUSE_ELIGIBLE_IDS.length, 43);

const fullHouseIds = new Set(fullHouse.steps.map((step) => step.movementId));
assert.deepEqual(
  FULL_HOUSE_ELIGIBLE_IDS.filter((movementId) => !fullHouseIds.has(movementId)),
  [],
  "Full House includes every eligible stationary movement"
);
FULL_HOUSE_EXCLUDED_IDS.forEach((movementId) => {
  assert.equal(fullHouseIds.has(movementId), false, `${movementId} is excluded from Full House`);
});

const fullHouseSlides = expandYogaClassSlides(fullHouse);
const sideKey = (slide) => `${slide.movement.id}:${slide.side ?? "single"}`;
const lowLungeIndex = fullHouseSlides.findIndex((slide) => slide.movement.id === "low-lunge");
assert.deepEqual(
  fullHouseSlides.slice(lowLungeIndex, lowLungeIndex + 6).map(sideKey),
  [
    "low-lunge:1",
    "half-kneeling-quad-stretch:1",
    "half-kneeling-hamstring-stretch:1",
    "seated-hamstring-stretch:1",
    "lizard-stretch:1",
    "pigeon-stretch:1"
  ],
  "related floor stretches stay on one side before switching"
);

const supineFigureFourIndex = fullHouseSlides.findIndex((slide) => slide.movement.id === "figure-4-stretch-supine");
assert.deepEqual(
  fullHouseSlides.slice(supineFigureFourIndex, supineFigureFourIndex + 4).map(sideKey),
  ["figure-4-stretch-supine:1", "supine-twist:1", "figure-4-stretch-supine:2", "supine-twist:2"],
  "supine figure-four flows directly into the twist on each side"
);

assert.deepEqual(
  getYogaClass("sun-salutation").steps.map((step) => step.movementId),
  [...SUN_SALUTATION_IDS],
  "Sun Salutation sequence remains unchanged"
);

for (const classId of ["the-ogs", "standing-and-balance", "hips-and-hamstrings", "floor-and-restore"]) {
  const yogaClass = getYogaClass(classId);
  assert.ok(yogaClass.steps.length > 0, `${classId} has steps`);
  assert.doesNotThrow(() => expandYogaClassSlides(yogaClass), `${classId} expands successfully`);
}

assert.deepEqual(validateYogaClasses(), [], "all built-in Yoga classes validate");
const beforeRun = getYogaClass("before-run");
assert.deepEqual(
  beforeRun.steps.map((step) => [step.movementId, step.seconds]),
  [
    ["ankle-circles", 15],
    ["ankle-rocks", 25],
    ["alternating-hip-openers", 30],
    ["knee-lift-torso-twists", 30],
    ["front-back-leg-swings", 15],
    ["lateral-leg-swings", 15],
    ["calf-rocks-heel-raises", 30],
    ["arm-circles", 30],
    ["squat-to-forward-fold", 30],
    ["forward-fold", 20],
    ["controlled-spinal-roll", 30]
  ],
  "Before Running follows the approved whole-body mobility sequence"
);
assert.equal(expandYogaClassSlides(beforeRun).length, 14, "three per-side movements expand to 14 guided movements");
assert.equal(getYogaClassDuration(beforeRun), 380, "Before Running lasts 6:20 including transitions");
assert.equal(beforeRun.sourceUrl, "https://www.youtube.com/watch?v=3WUtJxLv-wI");
assert.deepEqual(beforeRun.focusMuscles, ["Ankles", "Hips", "Calves", "Shoulders", "Hamstrings", "Back"]);

const beforeCycling = getYogaClass("before-cycling");
assert.deepEqual(
  beforeCycling.steps.map((step) => [step.movementId, step.seconds]),
  [
    ["knee-lifts", 30],
    ["hip-circles", 30],
    ["front-back-leg-swings", 15],
    ["lateral-leg-swings", 15],
    ["ankle-circles", 15],
    ["calf-raises", 30],
    ["alternating-reverse-lunges", 30],
    ["knee-bends", 30]
  ],
  "Before Cycling remains unchanged after moving its records into canonical data"
);

const animatedMovementIds = [
  "ankle-circles",
  "ankle-rocks",
  "alternating-hip-openers",
  "knee-lift-torso-twists",
  "front-back-leg-swings",
  "lateral-leg-swings",
  "calf-rocks-heel-raises",
  "arm-circles",
  "squat-to-forward-fold",
  "controlled-spinal-roll"
];

const pngDimensions = (assetPath) => {
  const buffer = fs.readFileSync(new URL(`../public/${assetPath}`, import.meta.url));
  assert.deepEqual([...buffer.subarray(1, 4)], [80, 78, 71], `${assetPath} is a PNG`);
  assert.ok([4, 6].includes(buffer[25]), `${assetPath} preserves an alpha channel`);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
};

animatedMovementIds.forEach((movementId) => {
  const movement = MOVEMENTS.find((candidate) => candidate.id === movementId);
  assert.ok(movement, `${movementId} exists in canonical movement data`);
  assert.ok(movement.visualFrames?.length >= 2, `${movementId} has an animated Mark frame set`);
  const dimensions = movement.visualFrames.map(pngDimensions);
  dimensions.forEach((size) => assert.deepEqual(size, dimensions[0], `${movementId} frames share one canvas size`));
  assert.ok(fs.existsSync(new URL(`../public/${movement.image}`, import.meta.url)), `${movementId} representative image exists`);
});

assert.equal(
  fs.existsSync(new URL("../preBikeWarmupPlugin.ts", import.meta.url)),
  false,
  "the build-only pre-bike data shim has been removed"
);
assert.deepEqual(
  YOGA_CLASSES.slice(0, 6).map((yogaClass) => yogaClass.id),
  ["sun-salutation", "full-house", "the-ogs", "standing-and-balance", "hips-and-hamstrings", "floor-and-restore"]
);

const sideLunge = expandYogaClassSlides(getYogaClass("standing-and-balance"))
  .find((slide) => slide.movement.id === "side-lunge")?.movement;
assert.equal(sideLunge?.image, "assets/stretches/side-lunge.png", "Side Lunge must bypass the incorrect processed display asset");
const yogaScreen = fs.readFileSync(new URL("../src/screens/YogaClassScreen.tsx", import.meta.url), "utf8");
assert.match(yogaScreen, /Skip warm-up/, "the before-run stretch player must have an obvious skip control");
assert.match(yogaScreen, /skipRunPrepStep/, "skipping stretches must update preparation state rather than depending on navigation mode");

console.log("Yoga checks passed");
