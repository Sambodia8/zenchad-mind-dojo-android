import { loadRunningProfile, type RunRecord, type RunCompanionId } from "./running";
import { loadCompletedBikeRides, type CompletedBikeRide } from "./bikeQuestHistory";
import { routeCandidateIsUsable, routeFingerprintFromPoints, scoreRunningRoute, type RunningRouteCandidate } from "./runningRouteDirector";

export type ZenCoachActivity = "run" | "bike" | "rest";
export type ZenCoachDecision = "accepted" | "rejected" | "snoozed" | "rest";
export type ZenCoachRescueReason = "no-drive" | "twenty-minutes" | "too-dark" | "yuna-finished" | "route-failed" | "tired";
export type ZenCoachEnjoyment = "loved" | "good" | "okay" | "not-for-me";
export type ZenCoachEffort = "easy" | "moderate" | "hard" | "too-hard";

export interface ZenCoachRouteOption {
  candidate: RunningRouteCandidate;
  /** Route data must come from a real provider. This is its last successful check, not a safety guarantee. */
  verifiedAt: number;
  label: string;
  travelMinutes: number;
  /** Only explicitly verified lighting may support a dark-time recommendation. */
  lit?: boolean;
  /** Optional, explicitly known local departure-window deadline. */
  sunsetAt?: number;
}

export interface ZenCoachProfile {
  version: 1;
  weeklyTarget: number;
  preferredActivity: "auto" | "run" | "bike";
  novelty: "balanced" | "familiar" | "surprise";
  coachStyle: "off" | "minimal" | "calm" | "enthusiastic" | "dry-humor";
  restUntil: number | null;
  snoozeUntil: number | null;
  decisions: ZenCoachStoredDecision[];
  feedback: ZenCoachStoredFeedback[];
}

export interface ZenCoachStoredDecision {
  planId: string;
  at: number;
  decision: ZenCoachDecision;
  activity: ZenCoachActivity;
  routeId?: string;
  travelMinutes: number;
  reason?: string;
}

export interface ZenCoachStoredFeedback {
  planId: string;
  at: number;
  enjoyment: ZenCoachEnjoyment;
  effort: ZenCoachEffort;
  reason?: string;
  routeId?: string;
}

export interface ZenCoachConstraints {
  availableMinutes?: number;
  energy?: "normal" | "low";
  preferActivity?: "run" | "bike";
  companionIds?: RunCompanionId[];
  noDriving?: boolean;
  isDark?: boolean;
  /** Only supply this from a location-aware sunset estimate or fresh provider result. */
  sunsetAt?: number;
  /** Known route-independent daylight buffer, default 30 minutes. */
  daylightBufferMinutes?: number;
}

export interface ZenCoachPlan {
  id: string;
  activity: ZenCoachActivity;
  title: string;
  minutes: number;
  effort: "easy" | "moderate";
  reason: string;
  route: ZenCoachRouteOption | null;
  travelMinutes: number;
  companionIds: RunCompanionId[];
  optional: boolean;
  notices: string[];
}

export interface ZenCoachRecommendation {
  primary: ZenCoachPlan;
  fallbacks: { b: ZenCoachPlan; c: ZenCoachPlan };
  weekly: { completed: number; target: number; remaining: number; windowStart: number };
  due: boolean;
  lastCompletedAt: number | null;
}

export interface ZenCoachInput {
  now: number;
  runs: RunRecord[];
  rides: CompletedBikeRide[];
  profile: ZenCoachProfile;
  routeOptions?: ZenCoachRouteOption[];
  constraints?: ZenCoachConstraints;
}

const PROFILE_KEY = "zenchad_zen_coach_profile_v1";
const ACCEPTED_PLAN_KEY = "zenchad_zen_coach_accepted_plan_v1";
const DAY = 86_400_000;

export function defaultZenCoachProfile(): ZenCoachProfile {
  return { version: 1, weeklyTarget: 3, preferredActivity: "auto", novelty: "balanced", coachStyle: "off", restUntil: null, snoozeUntil: null, decisions: [], feedback: [] };
}

function finiteTime(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function loadZenCoachProfile(): ZenCoachProfile {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null") as Partial<ZenCoachProfile> | null;
    if (!parsed || parsed.version !== 1) return defaultZenCoachProfile();
    return {
      version: 1,
      weeklyTarget: Number.isFinite(parsed.weeklyTarget) ? Math.max(1, Math.min(7, Math.round(parsed.weeklyTarget!))) : 3,
      preferredActivity: parsed.preferredActivity === "run" || parsed.preferredActivity === "bike" ? parsed.preferredActivity : "auto",
      novelty: parsed.novelty === "familiar" || parsed.novelty === "surprise" ? parsed.novelty : "balanced",
      coachStyle: ["minimal", "calm", "enthusiastic", "dry-humor"].includes(parsed.coachStyle ?? "") ? parsed.coachStyle! : "off",
      restUntil: finiteTime(parsed.restUntil),
      snoozeUntil: finiteTime(parsed.snoozeUntil),
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions.filter((item): item is ZenCoachStoredDecision => !!item && typeof item.planId === "string" && finiteTime(item.at) !== null && ["accepted", "rejected", "snoozed", "rest"].includes(item.decision)) .slice(-100) : [],
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback.filter((item): item is ZenCoachStoredFeedback => !!item && typeof item.planId === "string" && finiteTime(item.at) !== null && ["loved", "good", "okay", "not-for-me"].includes(item.enjoyment)) .slice(-100) : []
    };
  } catch {
    return defaultZenCoachProfile();
  }
}

export function saveZenCoachProfile(profile: ZenCoachProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

/** Keeps the one-tap choice available to the existing preparation flow for the rest of the day. */
export function saveAcceptedZenCoachPlan(plan: ZenCoachPlan | null) {
  if (!plan) {
    localStorage.removeItem(ACCEPTED_PLAN_KEY);
    return;
  }
  localStorage.setItem(ACCEPTED_PLAN_KEY, JSON.stringify({ savedAt: Date.now(), plan }));
}

export function loadAcceptedZenCoachPlan(): ZenCoachPlan | null {
  try {
    const stored = JSON.parse(localStorage.getItem(ACCEPTED_PLAN_KEY) || "null") as { savedAt?: number; plan?: ZenCoachPlan } | null;
    const plan = stored?.plan;
    if (!stored || !plan || !Number.isFinite(stored.savedAt) || Date.now() - stored.savedAt! > DAY || stored.savedAt! > Date.now()) return null;
    if (typeof plan.id !== "string" || !["run", "bike", "rest"].includes(plan.activity) || !Number.isFinite(plan.minutes) || plan.minutes < 0 || !Array.isArray(plan.companionIds)) return null;
    if (plan.route && (!Number.isFinite(plan.route.verifiedAt) || Date.now() - plan.route.verifiedAt > DAY || !routeCandidateIsUsable(plan.route.candidate))) return null;
    return plan;
  } catch {
    return null;
  }
}

function dateKey(now: number) {
  const date = new Date(now);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function makePlan(activity: ZenCoachActivity, minutes: number, reason: string, now: number, options: Partial<ZenCoachPlan> = {}): ZenCoachPlan {
  const route = options.route ?? null;
  return {
    id: `${dateKey(now)}:${activity}:${minutes}:${route?.candidate.id ?? "local"}`,
    activity,
    title: activity === "rest" ? "Rest today" : route ? `${route.label} · easy run` : activity === "bike" ? "Bike Quest ride" : "Local easy run",
    minutes,
    effort: "easy",
    reason,
    route,
    travelMinutes: route?.travelMinutes ?? 0,
    companionIds: options.companionIds ?? [],
    optional: options.optional ?? false,
    notices: options.notices ?? []
  };
}

function completedSessions(input: ZenCoachInput) {
  return [
    ...input.runs.filter((run) => Number.isFinite(run.endedAt) && run.endedAt <= input.now && run.durationSeconds > 0).map((run) => ({ at: run.endedAt, activity: "run" as const })),
    ...input.rides.filter((ride) => Number.isFinite(ride.completedAt) && ride.completedAt <= input.now && ride.rideSeconds > 0).map((ride) => ({ at: ride.completedAt, activity: "bike" as const }))
  ].sort((a, b) => b.at - a.at);
}

function chooseActivity(sessions: ReturnType<typeof completedSessions>, profile: ZenCoachProfile, constraints: ZenCoachConstraints): "run" | "bike" {
  if (constraints.preferActivity) return constraints.preferActivity;
  if (profile.preferredActivity !== "auto") return profile.preferredActivity;
  if (sessions.length >= 2 && sessions[0].activity === "run" && sessions[1].activity === "run") return "bike";
  if (sessions[0]?.activity === "bike") return "run";
  return "run";
}

function routeScore(option: ZenCoachRouteOption, input: ZenCoachInput, minutes: number) {
  const candidate = option.candidate;
  const base = scoreRunningRoute(candidate, { mode: "quick", plannedMinutes: minutes, start: candidate.geometry[0] }).score;
  const prior = input.profile.decisions.filter((decision) => decision.routeId === candidate.id && decision.decision === "rejected").length;
  const longDriveRejections = input.profile.decisions.filter((decision) => decision.decision === "rejected" && decision.reason === "travel" && decision.travelMinutes >= 20).length;
  const fingerprint = routeFingerprintFromPoints(candidate.geometry, candidate.distanceMeters);
  const visits = input.runs.filter((run) => run.endedAt <= input.now && (run.routeName === option.label || (fingerprint && fingerprint === routeFingerprintFromPoints(run.points, run.distanceMeters))));
  const lastVisit = Math.max(0, ...visits.map((run) => run.endedAt));
  const recentPenalty = lastVisit && input.now - lastVisit < 14 * DAY ? 0.3 : 0;
  const rediscovery = lastVisit && input.now - lastVisit >= 42 * DAY && visits.some((run) => run.isFavorite) ? 0.12 : 0;
  const feedback = input.profile.feedback.filter((item) => item.routeId === candidate.id);
  const feedbackScore = feedback.reduce((score, item) => score + (item.enjoyment === "loved" ? 0.1 : item.enjoyment === "not-for-me" ? -0.12 : 0) + (item.reason === "discomfort" ? -0.25 : 0), 0);
  const noveltyWeight = input.profile.novelty === "surprise" ? 0.18 : input.profile.novelty === "familiar" ? -0.15 : 0;
  return base + candidate.noveltyScore * noveltyWeight + rediscovery + Math.max(-0.4, Math.min(0.3, feedbackScore)) - recentPenalty - Math.min(0.3, prior * 0.12) - Math.min(0.35, longDriveRejections * 0.1) * Math.min(1, option.travelMinutes / 20) - option.travelMinutes * 0.003;
}

function feasibleRoute(option: ZenCoachRouteOption, input: ZenCoachInput, minutes: number) {
  const constraints = input.constraints ?? {};
  if (!Number.isFinite(option.verifiedAt) || option.verifiedAt > input.now || input.now - option.verifiedAt > DAY) return false;
  if (!routeCandidateIsUsable(option.candidate) || !Number.isFinite(option.travelMinutes) || option.travelMinutes < 0) return false;
  if (constraints.noDriving && option.travelMinutes > 0) return false;
  const localHour = new Date(input.now).getHours();
  const conservativelyDark = localHour < 6 || localHour >= 20;
  if ((constraints.isDark || conservativelyDark) && !option.lit) return false;
  const sunsetAt = option.sunsetAt ?? constraints.sunsetAt;
  if (sunsetAt && !option.lit) {
    const buffer = Math.max(0, Math.min(90, constraints.daylightBufferMinutes ?? 30));
    if (input.now + (10 + option.travelMinutes + minutes + buffer) * 60_000 > sunsetAt) return false;
  }
  return option.candidate.estimatedMinutes <= minutes * 1.3 && option.candidate.estimatedMinutes >= minutes * 0.65;
}

function yunaNotice(now: number, minutes: number, companionIds: RunCompanionId[]): string[] {
  if (!companionIds.includes("yuna")) return [];
  const dinner = new Date(now);
  dinner.setHours(18, 0, 0, 0);
  return now <= dinner.getTime() && now + (minutes + 10) * 60_000 >= dinner.getTime()
    ? ["Yuna's usual feeding time is around 18:00. Check her plan before leaving."] : [];
}

export function buildZenCoachRecommendation(input: ZenCoachInput): ZenCoachRecommendation {
  const constraints = input.constraints ?? {};
  const sessions = completedSessions(input);
  const target = Math.max(1, Math.min(7, input.profile.weeklyTarget || 3));
  const windowStart = input.now - 7 * DAY;
  const completed = sessions.filter((session) => session.at >= windowStart).length;
  const remaining = Math.max(0, target - completed);
  const lastCompletedAt = sessions[0]?.at ?? null;
  const optional = remaining === 0;
  const resting = !!input.profile.restUntil && input.profile.restUntil > input.now;
  const snoozed = !!input.profile.snoozeUntil && input.profile.snoozeUntil > input.now;
  const due = !resting && !snoozed && !optional && (lastCompletedAt === null || input.now - lastCompletedAt >= 2 * DAY);
  const companionIds = constraints.companionIds ?? [];
  const minutes = Math.max(10, Math.min(constraints.availableMinutes ?? 30, constraints.energy === "low" ? 20 : 30));
  const activity = chooseActivity(sessions, input.profile, constraints);
  const route = activity === "run" ? (input.routeOptions ?? []).filter((option) => feasibleRoute(option, input, minutes)).sort((a, b) => routeScore(b, input, minutes) - routeScore(a, input, minutes))[0] ?? null : null;
  const baseReason = sessions.length === 0 ? "A simple first session, close to home." : activity === "bike" ? "Your last two sessions were runs. Bike Quest adds variety." : optional ? "You've met your rolling seven-day goal. This is an optional extra." : due ? "About two days have passed since your last session." : "Keep the next session flexible around your day.";
  const reason = route ? `${baseReason} This route preview was recently checked.` : baseReason;
  const primary = resting
    ? makePlan("rest", 0, "You chose time to rest. Move again when you're ready.", input.now)
    : makePlan(activity, minutes, reason, input.now, { route, companionIds, optional, notices: yunaNotice(input.now, minutes, companionIds) });
  const shorter = Math.max(10, Math.min(20, Math.round(minutes * 0.6)));
  const b = resting
    ? makePlan("rest", 0, "Keep your planned rest.", input.now)
    : makePlan(activity, shorter, activity === "bike" ? "A shorter Bike Quest session at home." : "A shorter option near you, with no travel required.", input.now, { companionIds, optional });
  const c = resting || constraints.energy === "low"
    ? makePlan("rest", 0, "Rest is a valid choice today.", input.now)
    : makePlan(activity, 10, activity === "bike" ? "Ten easy minutes on your bike. Stop whenever you need." : "Ten easy minutes close to home. You can stop whenever you need.", input.now, { companionIds, optional });
  return { primary, fallbacks: { b, c }, weekly: { completed, target, remaining, windowStart }, due, lastCompletedAt };
}

export function getDailyZenCoachRecommendation(options: { now?: number; routeOptions?: ZenCoachRouteOption[]; constraints?: ZenCoachConstraints } = {}) {
  return buildZenCoachRecommendation({
    now: options.now ?? Date.now(),
    runs: loadRunningProfile().history,
    rides: loadCompletedBikeRides(),
    profile: loadZenCoachProfile(),
    routeOptions: options.routeOptions,
    constraints: options.constraints
  });
}

export function recordZenCoachDecision(profile: ZenCoachProfile, plan: ZenCoachPlan, decision: ZenCoachDecision, at = Date.now(), reason?: string): ZenCoachProfile {
  const entry: ZenCoachStoredDecision = { planId: plan.id, at, decision, activity: plan.activity, routeId: plan.route?.candidate.id, travelMinutes: plan.travelMinutes, reason };
  return {
    ...profile,
    restUntil: decision === "rest" ? at + DAY : profile.restUntil,
    snoozeUntil: decision === "snoozed" ? at + DAY : profile.snoozeUntil,
    decisions: [...profile.decisions, entry].slice(-100)
  };
}

export function recordZenCoachFeedback(profile: ZenCoachProfile, plan: ZenCoachPlan, feedback: Pick<ZenCoachStoredFeedback, "enjoyment" | "effort" | "reason">, at = Date.now()): ZenCoachProfile {
  return { ...profile, feedback: [...profile.feedback.filter((entry) => entry.planId !== plan.id), { ...feedback, planId: plan.id, at, routeId: plan.route?.candidate.id }].slice(-100) };
}

export function rescueZenCoachPlan(recommendation: ZenCoachRecommendation, reason: ZenCoachRescueReason): ZenCoachPlan {
  if (reason === "yuna-finished") return { ...recommendation.fallbacks.c, companionIds: recommendation.fallbacks.c.companionIds.filter((id) => id !== "yuna"), reason: "Yuna can stop. You can end the session or choose a short solo option." };
  if (reason === "tired") return recommendation.fallbacks.c;
  return recommendation.fallbacks.b;
}
