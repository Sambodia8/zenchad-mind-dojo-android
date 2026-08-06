export type BikeQuestStepId =
  | "vr-choice"
  | "vr-check"
  | "gear"
  | "shoes"
  | "pre-stretch"
  | "water"
  | "mount"
  | "ride"
  | "recovery"
  | "complete";

export type BikeQuestResume = "pre-stretch-complete" | "post-stretch-complete";
export type BikeVrChoice = "vr" | "no-vr";

export interface BikeQuestState {
  version: 1;
  startedAt: number;
  step: BikeQuestStepId;
  stepStartedAt: number;
  vrChoice: BikeVrChoice | null;
  vrDecisionSource: "manual" | "coin" | null;
  rideStartedAt: number | null;
  rideEndedAt: number | null;
  rideSeconds: number;
  armSets: number;
  preStretchCompleted: boolean;
  postStretchCompleted: boolean;
  postStretchSkipped: boolean;
  showerLogged: boolean;
  showerSkipped: boolean;
  totalQuestXp: number;
  awards: Record<string, number>;
}

export interface TimedStepConfig {
  title: string;
  instruction: string;
  image?: string;
  targetSeconds: number;
  graceSeconds: number;
  baseXp: number;
  bonusXp: number;
  buttonLabel: string;
}

const STORAGE_KEY = "zenchad_bike_quest_v1";

export const BIKE_TIMED_STEPS: Record<"gear" | "shoes" | "water" | "mount", TimedStepConfig> = {
  gear: {
    title: "Gear up",
    instruction: "Go to your exercise drawer and put your exercise clothes on.",
    targetSeconds: 4 * 60,
    graceSeconds: 4 * 60,
    baseXp: 20,
    bonusXp: 30,
    buttonLabel: "Dressed and ready"
  },
  shoes: {
    title: "Shoes on",
    instruction: "Put on the black slip-on bike shoes.",
    image: "assets/bike-quest/shoes.webp",
    targetSeconds: 90,
    graceSeconds: 90,
    baseXp: 20,
    bonusXp: 30,
    buttonLabel: "Shoes on"
  },
  water: {
    title: "Supplies",
    instruction: "Get your water bottle and sweat towel, then come back to the bike.",
    image: "assets/bike-quest/water.webp",
    targetSeconds: 3 * 60,
    graceSeconds: 3 * 60,
    baseXp: 20,
    bonusXp: 30,
    buttonLabel: "Water + towel ready"
  },
  mount: {
    title: "Mount up",
    instruction: "Get onto the bike and start pedalling. The ride timer begins when you press the button.",
    image: "assets/bike-quest/bike.webp",
    targetSeconds: 3 * 60,
    graceSeconds: 3 * 60,
    baseXp: 20,
    bonusXp: 30,
    buttonLabel: "I’m pedalling"
  }
};

export function createBikeQuestState(now = Date.now()): BikeQuestState {
  return {
    version: 1,
    startedAt: now,
    step: "vr-choice",
    stepStartedAt: now,
    vrChoice: null,
    vrDecisionSource: null,
    rideStartedAt: null,
    rideEndedAt: null,
    rideSeconds: 0,
    armSets: 0,
    preStretchCompleted: false,
    postStretchCompleted: false,
    postStretchSkipped: false,
    showerLogged: false,
    showerSkipped: false,
    totalQuestXp: 0,
    awards: {}
  };
}

export function loadBikeQuestState(): BikeQuestState | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Partial<BikeQuestState>;
    if (parsed.version !== 1 || !parsed.step || !parsed.startedAt) return null;
    return {
      ...createBikeQuestState(parsed.startedAt),
      ...parsed,
      awards: parsed.awards ?? {}
    };
  } catch {
    return null;
  }
}

export function saveBikeQuestState(state: BikeQuestState | null) {
  if (!state) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearBikeQuestState() {
  localStorage.removeItem(STORAGE_KEY);
}

export function timedStepXp(
  elapsedSeconds: number,
  targetSeconds: number,
  graceSeconds: number,
  baseXp: number,
  bonusXp: number
) {
  if (elapsedSeconds <= targetSeconds) return baseXp + bonusXp;
  if (graceSeconds <= 0) return baseXp;
  const overtime = elapsedSeconds - targetSeconds;
  if (overtime >= graceSeconds) return baseXp;
  const remainingFraction = 1 - overtime / graceSeconds;
  return baseXp + Math.max(0, Math.ceil(bonusXp * remainingFraction));
}

export function immediateBonusXp(
  elapsedSeconds: number,
  drainSeconds: number,
  baseXp: number,
  bonusXp: number
) {
  if (drainSeconds <= 0 || elapsedSeconds >= drainSeconds) return baseXp;
  const remainingFraction = 1 - elapsedSeconds / drainSeconds;
  return baseXp + Math.max(0, Math.ceil(bonusXp * remainingFraction));
}

export function projectedRideXp(seconds: number) {
  return 50 + Math.max(1, Math.floor(Math.max(1, seconds) / 6));
}
