import { loadRunSession } from "./running";
import {
  getNativeStorySnapshot,
  parseNativeStoryHeardLineKeys,
  replayNativeStoryLast,
  setNativeStoryAudioSettings,
  setNativeStoryDifficulty,
  type NativeStorySnapshot
} from "./runningNativeStory";
import type { ChaseDifficulty } from "./runningStory";
import { storyChaptersForLineKeys } from "./runningStoryChapters";
import { loadPlannedRunningRoute } from "./runningRouteStore";
import { removeStoryLivePanel, renderStoryLivePanel } from "./runningStoryLiveUi";

const CHASE_DOCK_ID = "zenchad-story-chase-dock";
const SETTINGS_ID = "zenchad-story-difficulty";
let started = false;
let polling = false;
let lastSnapshot: NativeStorySnapshot | null = null;

function setRadio(snapshot: NativeStorySnapshot) {
  const radio = document.querySelector<HTMLElement>(".running-story-radio");
  if (!radio) return;
  const titleNode = radio.querySelector<HTMLElement>("strong");
  const detailNode = radio.querySelector<HTMLElement>("small");
  if (titleNode) titleNode.textContent = snapshot.radioTitle || "COMMS ONLINE";
  if (detailNode) detailNode.textContent = snapshot.radioDetail || "Mission channel connected. Keep moving.";

  let audio = radio.querySelector<HTMLElement>(".running-story-audio-state");
  if (!audio) {
    audio = document.createElement("div");
    audio.className = "running-story-audio-state";
    audio.setAttribute("aria-live", "polite");
    radio.appendChild(audio);
  }
  const state = snapshot.audioState || "pending";
  audio.dataset.state = state;
  const headline = state === "playing"
    ? "NARRATION PLAYING"
    : state === "failed"
      ? "AUDIO FAILED"
      : state === "pending"
        ? "AUDIO PREPARING"
        : "NEXT SEGMENT PENDING";
  const detail = state === "failed"
    ? snapshot.audioError || "Narration could not play. The mission will keep tracking."
    : snapshot.audioLabel || "Story channel ready";
  const markup = `<span aria-hidden="true"></span><div><b>RUNNER STORY ACTIVE · ${headline}</b><small>${escapeText(detail)}</small></div>`;
  if (audio.innerHTML !== markup) audio.innerHTML = markup;
}

function escapeText(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character] ?? character);
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

function renderChase(snapshot: NativeStorySnapshot) {
  if (!snapshot.activeChase) {
    document.getElementById(CHASE_DOCK_ID)?.remove();
    return;
  }
  const dock = ensureChaseDock();
  if (!dock) return;
  const elapsed = Math.max(0, (Date.now() - snapshot.chaseStartedAt) / 1000);
  const duration = Math.max(1, snapshot.chaseDurationSeconds);
  const remaining = Math.max(0, duration - elapsed);
  const ratio = snapshot.chaseAchievedSpeedMps / Math.max(0.1, snapshot.chaseTargetSpeedMps);
  const title = dock.querySelector<HTMLElement>("[data-story-chase-title]");
  const detail = dock.querySelector<HTMLElement>("[data-story-chase-detail]");
  const clock = dock.querySelector<HTMLElement>("[data-story-chase-clock]");
  const bar = dock.querySelector<HTMLElement>("[data-story-chase-progress]");
  if (title) title.textContent = ratio >= 0.95 ? "YOU'RE OPENING A GAP" : "THEY'RE CLOSING";
  if (detail) detail.textContent = "Keep moving. The outcome changes the mission — not your XP.";
  if (clock) clock.textContent = `${Math.ceil(remaining)}s`;
  if (bar) bar.style.width = `${Math.min(100, elapsed / duration * 100)}%`;
}

function difficultyLabel(value: ChaseDifficulty) {
  return value === "casual" ? "Casual" : value === "intense" ? "Intense" : "Standard";
}

function percent(value: number | undefined, fallback: number) {
  const safe = Number.isFinite(value) ? Number(value) : fallback;
  return Math.round(Math.max(0, Math.min(1, safe)) * 100);
}

function syncStorySettings(snapshot: NativeStorySnapshot) {
  const session = loadRunSession();
  const briefing = document.querySelector<HTMLElement>(".running-briefing");
  if (!session || session.mode !== "story" || session.stage !== "briefing" || !briefing) {
    document.getElementById(SETTINGS_ID)?.remove();
    return;
  }

  let panel = document.getElementById(SETTINGS_ID);
  if (!panel) {
    panel = document.createElement("section");
    panel.id = SETTINGS_ID;
    panel.className = "running-story-difficulty";
    const primary = briefing.querySelector(".button.primary");
    if (primary) briefing.insertBefore(panel, primary);
    else briefing.appendChild(panel);
  }

  const sfxPercent = percent(snapshot.sfxVolume, 0.72);
  const voicePercent = percent(snapshot.voiceVolume, 0.92);
  panel.innerHTML = `
    <div><span class="eyebrow">Chase intensity</span><strong>${difficultyLabel(snapshot.difficulty)}</strong><small>The Director still adapts to your recent pace and how far into the run you are.</small></div>
    <div class="running-story-difficulty-buttons">
      ${(["casual", "standard", "intense"] as ChaseDifficulty[]).map((value) => `<button type="button" data-story-difficulty="${value}" class="${snapshot.difficulty === value ? "active" : ""}">${difficultyLabel(value)}</button>`).join("")}
    </div>
    <div class="running-story-audio-settings">
      <div class="running-story-audio-heading"><div><span class="eyebrow">Story audio</span><strong>Mix over your music</strong></div><button type="button" data-story-sfx-toggle class="${snapshot.sfxEnabled ? "active" : ""}">${snapshot.sfxEnabled ? "EFFECTS ON" : "EFFECTS MUTED"}</button></div>
      <label><span><strong>Effects</strong><small>Helicopter, gunfire, bullet passes and stingers</small></span><b data-story-sfx-value>${sfxPercent}%</b><input data-story-sfx-volume type="range" min="0" max="100" step="5" value="${sfxPercent}" ${snapshot.sfxEnabled ? "" : "disabled"}></label>
      <label><span><strong>Radio voice</strong><small>Story dialogue only — navigation stays separate</small></span><b data-story-voice-value>${voicePercent}%</b><input data-story-voice-volume type="range" min="0" max="100" step="5" value="${voicePercent}"></label>
      <small class="running-story-audio-note">These controls affect Zenchad only. They do not change your external music volume.</small>
    </div>
  `;

  panel.querySelectorAll<HTMLButtonElement>("[data-story-difficulty]").forEach((button) => {
    button.onclick = () => {
      const difficulty = button.dataset.storyDifficulty as ChaseDifficulty;
      void setNativeStoryDifficulty(difficulty).then((next) => {
        lastSnapshot = next;
        syncStorySettings(next);
      }).catch(() => {});
    };
  });

  const toggle = panel.querySelector<HTMLButtonElement>("[data-story-sfx-toggle]");
  if (toggle) {
    toggle.onclick = () => {
      void setNativeStoryAudioSettings({ sfxEnabled: !snapshot.sfxEnabled }).then((next) => {
        lastSnapshot = next;
        syncStorySettings(next);
      }).catch(() => {});
    };
  }

  const sfxSlider = panel.querySelector<HTMLInputElement>("[data-story-sfx-volume]");
  const sfxValue = panel.querySelector<HTMLElement>("[data-story-sfx-value]");
  if (sfxSlider) {
    sfxSlider.oninput = () => { if (sfxValue) sfxValue.textContent = `${sfxSlider.value}%`; };
    sfxSlider.onchange = () => {
      void setNativeStoryAudioSettings({ sfxVolume: Number(sfxSlider.value) / 100 }).then((next) => {
        lastSnapshot = next;
      }).catch(() => {});
    };
  }

  const voiceSlider = panel.querySelector<HTMLInputElement>("[data-story-voice-volume]");
  const voiceValue = panel.querySelector<HTMLElement>("[data-story-voice-value]");
  if (voiceSlider) {
    voiceSlider.oninput = () => { if (voiceValue) voiceValue.textContent = `${voiceSlider.value}%`; };
    voiceSlider.onchange = () => {
      void setNativeStoryAudioSettings({ voiceVolume: Number(voiceSlider.value) / 100 }).then((next) => {
        lastSnapshot = next;
      }).catch(() => {});
    };
  }
}

function render(snapshot: NativeStorySnapshot) {
  const session = loadRunSession();
  if (!session || session.mode !== "story") {
    document.getElementById(CHASE_DOCK_ID)?.remove();
    document.getElementById(SETTINGS_ID)?.remove();
    removeStoryLivePanel();
    return;
  }
  if (session.stage === "active") {
    setRadio(snapshot);
    const mission = loadPlannedRunningRoute(session.id)?.storyMission;
    renderStoryLivePanel({
      episode: mission?.episode ?? 1,
      missionTitle: (mission?.title ?? snapshot.missionTitle) || "Runner Story",
      phase: snapshot.phase,
      heardChapterIds: [...new Set([...session.storyHeardChapterIds, ...storyChaptersForLineKeys(parseNativeStoryHeardLineKeys(snapshot))])],
      audioState: snapshot.audioState,
      audioLabel: snapshot.audioLabel,
      audioError: snapshot.audioError,
      transcript: snapshot.audioTranscript,
      chaseCount: snapshot.chaseCount,
      helicopterTriggered: snapshot.helicopterTriggered,
      onReplay: () => { void replayNativeStoryLast().catch(() => {}); }
    });
    renderChase(snapshot);
  } else {
    document.getElementById(CHASE_DOCK_ID)?.remove();
    removeStoryLivePanel();
  }
  syncStorySettings(snapshot);
}

async function poll() {
  if (polling) {
    if (lastSnapshot) render(lastSnapshot);
    return;
  }
  polling = true;
  try {
    const snapshot = await getNativeStorySnapshot();
    lastSnapshot = snapshot;
    render(snapshot);
  } catch {
    if (lastSnapshot) render(lastSnapshot);
  } finally {
    polling = false;
  }
}

export function startRunningNativeStoryRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;
  document.addEventListener("visibilitychange", poll);
  window.addEventListener("pageshow", poll);
  window.setInterval(poll, 1000);
  queueMicrotask(poll);
}
