import type { Plugin } from "vite";

const movementAnchor = `  {
    id: "wall-calf-stretch",`;

const dynamicBikeMovements = `  {
    id: "hip-circles",
    name: "Hip Circles",
    image: "",
    seconds: 30,
    cue: "Stand tall and make smooth circles through the hips, gradually increasing the range without forcing it.",
    kind: "dynamic-warmup",
    sensationKind: "working",
    muscleGroups: ["Hip flexors", "Glutes", "Adductors"],
    sensationCue: "A loose, moving sensation around the hips and pelvis without pinching.",
    bodyAreas: [area(50, 59, 20, 11)]
  },
  {
    id: "front-back-leg-swings",
    name: "Front-to-Back Leg Swings",
    image: "",
    seconds: 15,
    sides: true,
    cue: "Hold a wall or the bike for balance and swing the working leg forward and back from the hip with a relaxed knee.",
    kind: "dynamic-warmup",
    sensationKind: "working",
    muscleGroups: ["Hip flexors", "Hamstrings", "Glutes"],
    sensationCue: "A controlled moving sensation through the front and back of the hip and thigh.",
    bodyAreas: [area(45, 65, 12, 22, -10)]
  },
  {
    id: "lateral-leg-swings",
    name: "Side-to-Side Leg Swings",
    image: "",
    seconds: 15,
    sides: true,
    cue: "Hold support and swing the working leg gently across and away from the body while keeping the torso steady.",
    kind: "dynamic-warmup",
    sensationKind: "working",
    muscleGroups: ["Adductors", "Abductors", "Glutes"],
    sensationCue: "A mobile, warming sensation through the inner and outer hip.",
    bodyAreas: [area(49, 67, 22, 10)]
  },
  {
    id: "ankle-circles",
    name: "Ankle Circles",
    image: "",
    seconds: 15,
    sides: true,
    cue: "Lift one foot just clear of the floor and draw slow circles with the toes in both directions.",
    kind: "dynamic-warmup",
    sensationKind: "working",
    muscleGroups: ["Ankles", "Calves"],
    sensationCue: "Easy movement around the ankle joint without forcing the range.",
    bodyAreas: [area(42, 82, 9, 7)]
  },
  {
    id: "calf-raises",
    name: "Calf Raises",
    image: "",
    seconds: 30,
    cue: "Rise smoothly onto the balls of both feet, pause briefly, then lower with control.",
    kind: "dynamic-warmup",
    sensationKind: "working",
    muscleGroups: ["Gastrocnemius", "Soleus", "Ankles"],
    sensationCue: "The calves should feel warm and active rather than stretched.",
    bodyAreas: [area(42, 72, 10, 18), area(60, 72, 10, 18)]
  },
  {
    id: "alternating-reverse-lunges",
    name: "Alternating Reverse Lunges",
    image: "",
    seconds: 30,
    cue: "Step one foot back into a comfortable lunge, return to standing, then alternate sides without holding the bottom position.",
    kind: "dynamic-warmup",
    sensationKind: "working",
    muscleGroups: ["Quadriceps", "Glutes", "Hip flexors"],
    sensationCue: "The thighs and glutes should feel active while the hips move through a comfortable range.",
    bodyAreas: [area(39, 64, 11, 19, -15), area(64, 69, 10, 19, 15)]
  },
`;

const originalBeforeCycling = `  {
    id: "before-cycling",
    name: "Before Cycling",
    timing: "Before indoor cycling",
    description: "A compact off-bike preparation for hips, thighs and knees before an easy spin.",
    evidence:
      "British Cycling recommends building intensity progressively on the bike. Use this class before, not instead of, an easy progressive on-bike warm-up.",
    sourceUrl: "https://www.britishcycling.org.uk/knowledge/article/izn20140115-Intermediate-Warming-Up-and-Cooling-Down-0",
    focusMuscles: ["Quadriceps", "Hip flexors", "Glutes", "Calves"],
    image: "assets/stretches/generated/indoor-cycling.png",
    steps: [
      { movementId: "knee-bends", seconds: 30 },
      { movementId: "standing-quad-stretch", seconds: 20 },
      { movementId: "high-lunge", seconds: 20 },
      { movementId: "kneeling-lunge", seconds: 25 },
      { movementId: "half-kneeling-quad-stretch", seconds: 20 }
    ]
  },`;

const updatedBeforeCycling = `  {
    id: "before-cycling",
    name: "Before Cycling",
    timing: "Before cycling",
    description: "A short dynamic off-bike warm-up for the ankles, hips, glutes and thighs before you start pedalling.",
    evidence:
      "Use this mobility sequence to get the joints and cycling muscles moving, then build cadence and resistance progressively once you are on the bike.",
    sourceUrl: "https://www.britishcycling.org.uk/knowledge/bike-kit/article/20251022-Set-up-Why-a-bike-fit-is-essential-for-indoor-training-0",
    focusMuscles: ["Quadriceps", "Hip flexors", "Glutes", "Calves", "Ankles"],
    image: "assets/stretches/generated/indoor-cycling.png",
    steps: [
      { movementId: "knee-lifts", seconds: 30 },
      { movementId: "hip-circles", seconds: 30 },
      { movementId: "front-back-leg-swings", seconds: 15 },
      { movementId: "lateral-leg-swings", seconds: 15 },
      { movementId: "ankle-circles", seconds: 15 },
      { movementId: "calf-raises", seconds: 30 },
      { movementId: "alternating-reverse-lunges", seconds: 30 },
      { movementId: "knee-bends", seconds: 30 }
    ]
  },`;

export default function preBikeWarmupPlugin(): Plugin {
  return {
    name: "zenchad-pre-bike-warmup",
    enforce: "pre",
    transform(code, id) {
      const cleanId = id.split("?", 1)[0];
      if (!/[\\/]src[\\/]data\.ts$/.test(cleanId)) return null;

      let next = code;

      if (!next.includes('id: "hip-circles"')) {
        if (!next.includes(movementAnchor)) {
          throw new Error("Zen Chad pre-bike patch could not find the movement catalogue anchor.");
        }
        next = next.replace(movementAnchor, `${dynamicBikeMovements}${movementAnchor}`);
      }

      if (next.includes(originalBeforeCycling)) {
        next = next.replace(originalBeforeCycling, updatedBeforeCycling);
      } else if (!next.includes('description: "A short dynamic off-bike warm-up')) {
        throw new Error("Zen Chad pre-bike patch could not find the Before Cycling routine.");
      }

      return { code: next, map: null };
    }
  };
}
