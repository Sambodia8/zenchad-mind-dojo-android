import assert from "node:assert/strict";
import {
  FULL_HOUSE_ELIGIBLE_IDS,
  FULL_HOUSE_EXCLUDED_IDS,
  MARKS_FLOW_IDS,
  SUN_SALUTATION_IDS,
  YOGA_CLASSES,
  expandYogaClassSlides,
  getYogaClass,
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
assert.ok(beforeRun.steps.some((step) => step.movementId === "wall-calf-stretch"));
assert.ok(beforeRun.steps.some((step) => step.movementId === "standing-quad-stretch"));
assert.equal(
  expandYogaClassSlides(beforeRun).find((slide) => slide.movement.id === "standing-quad-stretch")?.movement.name,
  "Standing Knee Flexion Stretch"
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
