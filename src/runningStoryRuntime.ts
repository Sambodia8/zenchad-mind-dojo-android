import { loadRunSession, type RunPoint, type RunSession } from "./running";
import { navigationStateForLocation } from "./runningNavigation";
import { loadPlannedRunningRoute, type PlannedRunningRoute } from "./runningRouteStore";
import { badAccelerationAnchorNear, nextStoryCoverAnchor } from "./runningRouteSemantics";
import { chaseTarget, evaluateChase } from "./runningStory";
import { speakStoryLine } from "./runningStorySpeech";
import type { StoryMissionDefinition } from "./runningCampaign";
import {
  createStoryRunRuntimeState,
  loadStoryRunRuntimeState,
  markStoryLinePlayed,
  saveStoryRunRuntimeState,
  storyLineWasPlayed,
  type StoryRunRuntimeState
} from "./runningStoryState";

const CHASE_DOCK_ID = "zenchad-story-chase-dock";
let started = false;
let speaking = false;
let nearestShapeIndex = 0;

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function latestPoint(session: RunSession) {
  return session.points[session.points.length - 1] ?? null;
}

function recentSpeedMps(points: RunPoint[], windowSeconds = 40) {
  if (points.length < 2) return 0;
  const last = points[points.length - 1];
  const threshold = last.at - windowSeconds * 1000;
  let first = points[0];
  for (let index = points.length - 2; index >= 0; index -= 1) {
    first = points[index];
    if (first.at <= threshold) break;
  }
  const elapsed = Math.max(1, (last.at - first.at) / 1000);
  const lastDistance = last.distanceFromStart ?? 0;
  const firstDistance = first.distanceFromStart ?? 0;
  return Math.max(0, (lastDistance - firstDistance) / elapsed);
}

function elapsedRunSeconds(session: RunSession) {
  return session.runStartedAt ? Math.max(0, (Date.now() - session.runStartedAt) / 1000) : 0;
}

function routeProgress(route: PlannedRunningRoute, session: RunSession) {
  const point = latestPoint(session);
  if (!point) return null;
  const navigation = navigationStateForLocation(route, { lat: point.lat, lng: point.lng }, nearestShapeIndex);
  nearestShapeIndex = navigation.nearestShapeIndex;
  return navigation;
}

function setRadio(title: string, detail: string) {
  const radio = document.querySelector<HTMLElement>(".running-story-radio");
  if (!radio) return;
  const titleNode = radio.querySelector<HTMLElement>("strong");
  const detailNode = radio.querySelector<HTMLElement>("small");
  if (titleNode) titleNode.textContent = title;
  if (detailNode) detailNode.textContent = detail;
}

function speakLine(state: StoryRunRuntimeState, id: string, title: string, detail: string, speech: string) {
  if (storyLineWasPlayed(state, id)) return state;
  const next = markStoryLinePlayed({ ...state, lastRadioTitle: title, lastRadioDetail: detail }, id);
  saveStoryRunRuntimeState(next);
  setRadio(title, detail);
  if (!speaking) {
    speaking = true;
    void speakStoryLine(speech).finally(() => { speaking = false; });
  }
  return next;
}

function ensureChaseDock() {
  const existing = document.getElementById(CHASE_DOCK_ID);
  if (existing) return existing;
  const radio = document.querySelector<HTMLElement>(".running-story-radio");
  if (!radio?.parentElement) return null;
  const dock = document.createElement("section");
  dock.id = CHASE_DOCK_ID;
  dock.className = "running-story-chase-dock";
  dock.innerHTML = `
    <div class="running-chase-pulse" aria-hidden="true"></div>
    <div class="running-chase-copy"><span class="eyebrow">PURSUIT</span><strong data-story-chase-title>MOVE</strong><small data-story-chase-detail></small></div>
    <b data-story-chase-clock></b>
    <div class="running-chase-track"><span data-story-chase-progress></span></div>
  `;
  radio.insertAdjacentElement("afterend", dock);
  return dock;
}

function removeChaseDock() {
  document.getElementById(CHASE_DOCK_ID)?.remove();
}

function updateChaseDock(state: StoryRunRuntimeState, session: RunSession) {
  const chase = state.activeChase;
  if (!chase) {
    removeChaseDock();
    return;
  }
  const dock = ensureChaseDock();
  if (!dock) return;
  const elapsed = Math.max(0, (Date.now() - chase.startedAt) / 1000);
  const remaining = Math.max(0, chase.durationSeconds - elapsed);
  const progress = Math.min(1, elapsed / Math.max(1, chase.durationSeconds));
  const moved = Math.max(0, session.distanceMeters - chase.startDistanceMeters);
  const achieved = elapsed > 3 ? moved / elapsed : 0;
  const title = dock.querySelector<HTMLElement>("[data-story-chase-title]");
  const detail = dock.querySelector<HTMLElement>("[data-story-chase-detail]");
  const clock = dock.querySelector<HTMLElement>("[data-story-chase-clock]");
  const bar = dock.querySelector<HTMLElement>("[data-story-chase-progress]");
  if (title) title.textContent = achieved >= chase.targetSpeedMps * 0.95 ? "YOU'RE OPENING A GAP" : "THEY'RE CLOSING";
  if (detail) detail.textContent = "Keep moving. The outcome changes the mission — not your XP.";
  if (clock) clock.textContent = `${Math.ceil(remaining)}s`;
  if (bar) bar.style.width = `${progress * 100}%`;
}

function startChase(state: StoryRunRuntimeState, session: RunSession, mission?: StoryMissionDefinition) {
  const recentSpeed = recentSpeedMps(session.points);
  if (recentSpeed < 1.2) return state;
  const elapsed = elapsedRunSeconds(session);
  const target = chaseTarget({
    difficulty: state.difficulty,
    recentSpeedMps: recentSpeed,
    elapsedRunSeconds: elapsed,
    plannedRunSeconds: session.plannedMinutes * 60,
    previousChases: state.chases.map((chase) => ({
      targetSpeedMps: chase.targetSpeedMps,
      achievedSpeedMps: chase.achievedSpeedMps
    }))
  });
  const variation = (hashString(`${session.id}:${state.chases.length}`) % 31) - 15;
  const durationSeconds = Math.max(20, Math.min(90, target.suggestedDurationSeconds + variation));
  const next: StoryRunRuntimeState = {
    ...state,
    phase: "chase",
    activeChase: {
      startedAt: Date.now(),
      durationSeconds,
      targetSpeedMps: target.targetSpeedMps,
      startDistanceMeters: session.distanceMeters
    },
    lastRadioTitle: "PURSUIT · MOVE",
    lastRadioDetail: `Adaptive chase · ${durationSeconds} seconds`
  };
  navigator.vibrate?.([45, 35, 80, 35, 120]);
  setRadio(next.lastRadioTitle, next.lastRadioDetail);
  if (!speaking) {
    speaking = true;
    void speakStoryLine(mission?.pursuerLine ?? "Keep running. I can see you. You won't keep the gap.")
      .finally(() => { speaking = false; });
  }
  saveStoryRunRuntimeState(next);
  return next;
}

function finishChase(state: StoryRunRuntimeState, session: RunSession) {
  const chase = state.activeChase;
  if (!chase) return state;
  const elapsed = Math.max(1, (Date.now() - chase.startedAt) / 1000);
  const achievedSpeedMps = Math.max(0, (session.distanceMeters - chase.startDistanceMeters) / elapsed);
  const outcome = evaluateChase(chase.targetSpeedMps, achievedSpeedMps);
  const record = {
    startedAt: chase.startedAt,
    durationSeconds: chase.durationSeconds,
    targetSpeedMps: chase.targetSpeedMps,
    achievedSpeedMps,
    outcome: outcome.kind
  };

  let title = "PURSUIT BROKEN";
  let detail = "Nice. They lost the line.";
  let speech = "Nice. You opened the gap. They lost the line. Settle back into your rhythm.";
  if (outcome.kind === "pressure") {
    title = "THEY'RE STILL WITH YOU";
    detail = "Pressure stays in the story. No XP lost.";
    speech = "They're still with you. Don't force it. Keep moving and I'll change the plan.";
  } else if (outcome.kind === "caught-branch") {
    title = "INTERCEPTED · NEW PLAN";
    detail = "The mission branches. Your run is still fully banked.";
    speech = "They've cut you off. Change of plan. Keep moving. This isn't over.";
  }

  const next: StoryRunRuntimeState = {
    ...state,
    phase: "aftermath",
    activeChase: null,
    chases: [...state.chases, record],
    nextEventAfter: Date.now() + 90_000,
    lastRadioTitle: title,
    lastRadioDetail: detail
  };
  removeChaseDock();
  setRadio(title, detail);
  navigator.vibrate?.([30, 35, 75]);
  if (!speaking) {
    speaking = true;
    void speakStoryLine(speech).finally(() => { speaking = false; });
  }
  saveStoryRunRuntimeState(next);
  return next;
}

function maybeStartHelicopter(
  state: StoryRunRuntimeState,
  session: RunSession,
  route: PlannedRunningRoute,
  progressMeters: number,
  completionRatio: number
) {
  if (state.helicopterTriggered || state.phase === "chase" || Date.now() < state.nextEventAfter || completionRatio < 0.52) return state;
  const cover = nextStoryCoverAnchor(route.storyAnchors ?? [], progressMeters);
  if (!cover) return state;
  const next: StoryRunRuntimeState = {
    ...state,
    phase: "helicopter",
    helicopterTriggered: true,
    helicopterTargetDistance: cover.distanceMeters,
    lastRadioTitle: "AIR UNIT HAS VISUAL",
    lastRadioDetail: `Keep running · cover ${Math.max(0, Math.round(cover.distanceMeters - progressMeters))} m ahead`
  };
  setRadio(next.lastRadioTitle, next.lastRadioDetail);
  navigator.vibrate?.([60, 60, 60]);
  if (!speaking) {
    speaking = true;
    void speakStoryLine("Runner. Air unit above us. They've got visual. Keep running. Cover ahead — get under it.")
      .finally(() => { speaking = false; });
  }
  saveStoryRunRuntimeState(next);
  return next;
}

function maybeResolveHelicopter(state: StoryRunRuntimeState, progressMeters: number) {
  if (state.phase !== "helicopter" || state.helicopterTargetDistance === null) return state;
  const remaining = state.helicopterTargetDistance - progressMeters;
  if (remaining > 18) {
    const detail = `Keep running · cover ${Math.max(0, Math.round(remaining))} m ahead`;
    if (detail !== state.lastRadioDetail) {
      const next = { ...state, lastRadioDetail: detail };
      saveStoryRunRuntimeState(next);
      setRadio(next.lastRadioTitle, detail);
      return next;
    }
    return state;
  }

  const next: StoryRunRuntimeState = {
    ...state,
    phase: "aftermath",
    helicopterTargetDistance: null,
    nextEventAfter: Date.now() + 120_000,
    lastRadioTitle: "VISUAL BROKEN",
    lastRadioDetail: "Cover reached. Keep the line moving."
  };
  setRadio(next.lastRadioTitle, next.lastRadioDetail);
  if (!speaking) {
    speaking = true;
    void speakStoryLine("Cover reached. They've lost visual. Nice work. Keep moving.")
      .finally(() => { speaking = false; });
  }
  saveStoryRunRuntimeState(next);
  return next;
}

function tickStoryRun() {
  const session = loadRunSession();
  if (!session || session.mode !== "story" || session.stage !== "active" || !session.runStartedAt) {
    removeChaseDock();
    return;
  }

  let state = loadStoryRunRuntimeState(session.id) ?? createStoryRunRuntimeState(session.id);
  if (!loadStoryRunRuntimeState(session.id)) saveStoryRunRuntimeState(state);
  const elapsed = elapsedRunSeconds(session);
  const completionRatio = elapsed / Math.max(60, session.plannedMinutes * 60);
  const route = loadPlannedRunningRoute(session.id);

  setRadio(state.lastRadioTitle, state.lastRadioDetail);

  if (elapsed >= 8 && !storyLineWasPlayed(state, "opening-1")) {
    state = speakLine(
      state,
      "opening-1",
      "GHOST SIGNAL · COMMS ONLINE",
      "Relay key secured. Keep moving.",
      "Runner. Comms check. You're carrying a relay key the city grid thinks was destroyed. Keep moving. I'll handle the route."
    );
  }

  if (elapsed >= 75 && !storyLineWasPlayed(state, "opening-2")) {
    state = speakLine(
      { ...state, phase: "cruise", nextEventAfter: Math.max(state.nextEventAfter, Date.now() + 50_000) },
      "opening-2",
      "WATCHER ON THE LINE",
      "Not a problem yet. Keep your rhythm.",
      "We've got a watcher behind you. Not a problem yet. Keep your rhythm."
    );
  }

  if (state.phase === "chase" && state.activeChase) {
    updateChaseDock(state, session);
    if ((Date.now() - state.activeChase.startedAt) / 1000 >= state.activeChase.durationSeconds) {
      state = finishChase(state, session);
    }
    return;
  }

  if (!route) return;
  const progress = routeProgress(route, session);
  if (!progress) return;

  state = maybeResolveHelicopter(state, progress.routeProgressMeters);
  if (state.phase === "helicopter") return;

  const chaseWindowOpen =
    elapsed >= Math.max(150, session.plannedMinutes * 60 * 0.14) &&
    completionRatio < 0.76 &&
    state.chases.length < 2 &&
    Date.now() >= state.nextEventAfter;

  if (chaseWindowOpen && route.semanticsStatus === "ready") {
    const blocked = badAccelerationAnchorNear(route.storyAnchors ?? [], progress.routeProgressMeters);
    if (!blocked && progress.offRouteMeters <= 55) {
      state = startChase(state, session, route.storyMission);
      if (state.phase === "chase") return;
    }
  }

  state = maybeStartHelicopter(state, session, route, progress.routeProgressMeters, completionRatio);

  if (completionRatio >= 0.84 && !storyLineWasPlayed(state, "home-stretch")) {
    state = speakLine(
      { ...state, phase: "home" },
      "home-stretch",
      "EXTRACTION WINDOW",
      "Almost clear. Bring the relay key home.",
      "You're almost clear, Runner. Bring the relay key home."
    );
  }

  saveStoryRunRuntimeState(state);
}

export function startRunningStoryRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;
  window.addEventListener("storage", tickStoryRun);
  window.setInterval(tickStoryRun, 1000);
  queueMicrotask(tickStoryRun);
}
