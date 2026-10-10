import type { YogaClass } from "./types";

export const CLASS_PRESENTATION: Record<string, { atmosphere: "energy" | "restore" | "flow"; pose: string; action?: string; context?: string }> = {
  "sun-salutation": { atmosphere: "flow", pose: "an upward salute at celestial sunrise" },
  "full-house": { atmosphere: "flow", pose: "Warrior II on a celestial platform" },
  "the-ogs": { atmosphere: "flow", pose: "a classic downward-facing dog" },
  "standing-and-balance": { atmosphere: "energy", pose: "tree pose against cosmic mountains" },
  "hips-and-hamstrings": { atmosphere: "restore", pose: "a low lunge under a quiet violet sky" },
  "floor-and-restore": { atmosphere: "restore", pose: "child’s pose in a tranquil celestial sanctuary" },
  "daily-reset": { atmosphere: "flow", pose: "a gentle standing side stretch" },
  "before-run": { atmosphere: "energy", pose: "a dynamic knee lift on a celestial trail", action: "BEGIN WARM-UP", context: "Dynamic warm-up" },
  "before-cycling": { atmosphere: "energy", pose: "a standing quad stretch beside a bicycle", action: "BEGIN WARM-UP", context: "Off-bike warm-up" },
  "after-run": { atmosphere: "restore", pose: "a comfortable post-run hamstring stretch", action: "BEGIN COOL-DOWN", context: "Post-run recovery" },
  "after-cycling": { atmosphere: "restore", pose: "a seated recovery stretch beside an indoor bicycle", action: "BEGIN COOL-DOWN", context: "Post-ride recovery" },
  "back-and-shoulders": { atmosphere: "flow", pose: "a kneeling side stretch" },
  "gentle-leg-recovery": { atmosphere: "restore", pose: "a gentle supported seated leg stretch", action: "BEGIN GENTLY" }
};

export const getClassPresentation = (yogaClass: YogaClass) => {
  const builtIn = CLASS_PRESENTATION[yogaClass.id];
  return {
    atmosphere: builtIn?.atmosphere ?? "flow",
    action: builtIn?.action ?? "START CLASS",
    context: builtIn?.context ?? yogaClass.timing,
    image: (!builtIn && (!yogaClass.image || yogaClass.image === "assets/yoga/class-cover-flow-v2.png"))
      ? "assets/yoga/intros/daily-reset.webp" : yogaClass.image,
    imageAlt: builtIn ? `Mark performing ${builtIn.pose}` : `Artwork for ${yogaClass.name}`
  };
};
