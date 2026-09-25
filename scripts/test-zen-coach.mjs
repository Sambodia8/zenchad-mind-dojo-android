import assert from "node:assert/strict";

const stored = new Map();
globalThis.localStorage = {
  getItem(key) { return stored.get(key) ?? null; },
  setItem(key, value) { stored.set(key, value); },
  removeItem(key) { stored.delete(key); }
};

const {
  buildZenCoachRecommendation,
  defaultZenCoachProfile,
  getDailyZenCoachRecommendation,
  loadAcceptedZenCoachPlan,
  loadZenCoachProfile,
  recordZenCoachDecision,
  recordZenCoachFeedback,
  rescueZenCoachPlan,
  saveAcceptedZenCoachPlan,
  saveZenCoachProfile
} = await import("../src/zenCoach.ts");
const { routeFingerprintFromPoints, chooseRunningRoute } = await import("../src/runningRouteDirector.ts");
const { buildZenCoachAtlas } = await import("../src/zenCoachAtlas.ts");

const day = 86_400_000;
const now = new Date(2026, 8, 25, 12).getTime();
const profile = defaultZenCoachProfile();
const run = (id, daysAgo, routeName = "Recorded route") => ({ id, endedAt: now - daysAgo * day, durationSeconds: 1800, routeName, isFavorite: false, points: [], distanceMeters: 4000 });
const ride = (id, daysAgo) => ({ id, completedAt: now - daysAgo * day, rideSeconds: 2400 });
const input = (runs = [], rides = [], extras = {}) => ({ now, runs, rides, profile, ...extras });

const cold = buildZenCoachRecommendation(input());
assert.equal(cold.weekly.completed, 0);
assert.equal(cold.weekly.target, 3);
assert.equal(cold.primary.activity, "run");
assert.equal(cold.primary.route, null, "offline cold start must not invent a mapped route");
assert.equal(cold.due, true);
assert.equal(cold.fallbacks.c.minutes, 10);

const mixed = buildZenCoachRecommendation(input([run("r1", 1), run("r2", 3)], [ride("b1", 5)]));
assert.deepEqual(mixed.weekly, { completed: 3, target: 3, remaining: 0, windowStart: now - 7 * day });
assert.equal(mixed.primary.optional, true);
assert.equal(mixed.due, false);
const older = buildZenCoachRecommendation(input([run("old", 8)], []));
assert.equal(older.weekly.completed, 0, "weekly target is rolling, not tied to a calendar week");
assert.equal(older.lastCompletedAt, now - 8 * day);

const twoRuns = buildZenCoachRecommendation(input([run("recent", 1), run("before", 3)]));
assert.equal(twoRuns.primary.activity, "bike", "two recent runs should add modality variety");
assert.equal(buildZenCoachRecommendation(input([run("recent", 1)], [], { constraints: { preferActivity: "run", availableMinutes: 20, energy: "low" } })).primary.minutes, 20);

const resting = buildZenCoachRecommendation(input([], [], { profile: { ...profile, restUntil: now + day } }));
assert.equal(resting.primary.activity, "rest");
assert.equal(resting.due, false);
assert.equal(buildZenCoachRecommendation(input([], [], { profile: { ...profile, snoozeUntil: now + day } })).due, false);

const geometryA = [{ lat: 51.5, lng: -0.1 }, { lat: 51.505, lng: -0.095 }, { lat: 51.5, lng: -0.1 }];
const geometryB = [{ lat: 51.50001, lng: -0.10001 }, { lat: 51.50501, lng: -0.09501 }, { lat: 51.50001, lng: -0.10001 }];
assert.equal(routeFingerprintFromPoints(geometryA, 4000), routeFingerprintFromPoints(geometryB, 4020), "small GPS noise should group the same recording");
const shortPrivateRun = { ...run("private", 2), points: [{ lat: 51.5, lng: -0.1, accuracy: 10, at: now - 1000 }, { lat: 51.5005, lng: -0.1, accuracy: 10, at: now }], distanceMeters: 60 };
assert.deepEqual(buildZenCoachAtlas([shortPrivateRun], 200, now)[0].previewPoints, [], "Atlas must omit a trace that cannot be safely trimmed");
const candidate = (id, geometry, noveltyScore = 0.7) => ({ id, geometry, estimatedMinutes: 30, distanceMeters: 4000, endsNearStart: true, endDistanceFromStartMeters: 0, noveltyScore, interestScore: 0.6, familiarityScore: 0.3, gameOpportunityScore: 0.5, routeConfidence: 0.9, uncertainShortcutCount: 0 });
const option = (id, geometry, travelMinutes = 0, extras = {}) => ({ candidate: candidate(id, geometry), verifiedAt: now - 60_000, label: id, travelMinutes, ...extras });
const routes = [option("recent", geometryA), option("fresh", [{ lat: 51.6, lng: -0.1 }, { lat: 51.605, lng: -0.095 }, { lat: 51.6, lng: -0.1 }])];
const recentRun = { ...run("r", 2, "Another name"), points: geometryB };
assert.equal(buildZenCoachRecommendation(input([recentRun], [], { routeOptions: routes })).primary.route?.candidate.id, "fresh", "recently repeated recording should lose to a feasible fresh route");
assert.equal(buildZenCoachRecommendation(input([], [], { routeOptions: [option("stale", geometryA, 0, { verifiedAt: now - 2 * day })] })).primary.route, null);
assert.equal(buildZenCoachRecommendation(input([], [], { routeOptions: [option("dark", geometryA)], constraints: { isDark: true } })).primary.route, null);
assert.equal(buildZenCoachRecommendation(input([], [], { routeOptions: [option("dusk", geometryA, 30, { sunsetAt: now + 55 * 60_000 })] })).primary.route, null, "drive plus exercise plus buffer exceeds known sunset");
assert.equal(buildZenCoachRecommendation(input([], [], { routeOptions: [option("drive", geometryA, 30)], constraints: { noDriving: true } })).primary.route, null);
const uncertain = candidate("shortcut", geometryA);
uncertain.uncertainShortcutCount = 1;
assert.equal(chooseRunningRoute([uncertain], { mode: "quick", plannedMinutes: 30, start: geometryA[0] }), null);

const travelRejected = recordZenCoachDecision(profile, { ...cold.primary, route: option("drive", geometryA, 40), travelMinutes: 40 }, "rejected", now, "travel");
assert.equal(travelRejected.decisions[0].reason, "travel");
const attractiveDrive = option("attractive-drive", geometryA, 40);
attractiveDrive.candidate.noveltyScore = 1;
attractiveDrive.candidate.interestScore = 1;
const plainLocal = option("plain-local", routes[1].candidate.geometry);
plainLocal.candidate.noveltyScore = 0.1;
plainLocal.candidate.interestScore = 0.1;
assert.equal(buildZenCoachRecommendation(input([], [], { routeOptions: [attractiveDrive, plainLocal] })).primary.route?.candidate.id, "attractive-drive");
let repeatedTravelRejections = profile;
for (let index = 0; index < 3; index += 1) {
  repeatedTravelRejections = recordZenCoachDecision(repeatedTravelRejections, { ...cold.primary, route: attractiveDrive, travelMinutes: 40 }, "rejected", now - index * day, "travel");
}
assert.equal(buildZenCoachRecommendation(input([], [], { profile: repeatedTravelRejections, routeOptions: [attractiveDrive, plainLocal] })).primary.route?.candidate.id, "plain-local", "repeated long-drive rejection should change the pick");
const feedback = recordZenCoachFeedback(profile, cold.primary, { enjoyment: "good", effort: "moderate" }, now);
assert.equal(feedback.feedback.length, 1);
assert.equal(rescueZenCoachPlan(cold, "twenty-minutes").minutes <= 20, true);
assert.equal(rescueZenCoachPlan(cold, "route-failed").route, null, "rescue must not invent a navigable shortcut");
const yuna = buildZenCoachRecommendation(input([], [], { constraints: { companionIds: ["yuna"] } }));
assert.deepEqual(rescueZenCoachPlan(yuna, "yuna-finished").companionIds, []);

saveZenCoachProfile({ ...profile, coachStyle: "calm" });
assert.equal(loadZenCoachProfile().coachStyle, "calm");
saveAcceptedZenCoachPlan(cold.primary);
assert.equal(loadAcceptedZenCoachPlan()?.id, cold.primary.id);
saveAcceptedZenCoachPlan(null);
assert.equal(loadAcceptedZenCoachPlan(), null);
assert.equal(getDailyZenCoachRecommendation({ now }).weekly.completed, 0);

console.log("Zen Coach engine scenarios passed");
