import { loadRunSession } from "./running";
import { loadPlannedRunningRoute, loadRunningRouteBuildState } from "./runningRouteStore";

const ACTIONS_ID = "zenchad-running-route-fallback-actions";
let started = false;

function briefingFallback() {
  const session = loadRunSession();
  const note = document.querySelector<HTMLElement>(".running-route-note");
  const existing = document.getElementById(ACTIONS_ID);
  if (!session || session.stage !== "briefing" || !note || loadPlannedRunningRoute(session.id)) {
    existing?.remove();
    return;
  }
  const state = loadRunningRouteBuildState(session.id);
  if (state?.status !== "error") {
    existing?.remove();
    return;
  }

  const strong = note.querySelector<HTMLElement>("strong");
  const small = note.querySelector<HTMLElement>("small");
  if (strong) strong.textContent = "Route unavailable — your run is not cancelled";
  if (small) {
    small.textContent = session.mode === "story"
      ? "GPS, time, XP and kilometre rewards still work. Zenchad will keep trying the route service; Story navigation and location set-pieces can join if it recovers."
      : "GPS, time, XP and kilometre rewards still work. Zenchad will keep trying the route service while you get ready or run.";
  }

  let actions = existing;
  if (!actions) {
    actions = document.createElement("div");
    actions.id = ACTIONS_ID;
    actions.className = "running-route-fallback-actions";
    note.insertAdjacentElement("afterend", actions);
  }
  actions.innerHTML = `
    <button type="button" class="button secondary" data-route-retry>TRY ROUTE AGAIN</button>
    <button type="button" class="button primary" data-route-continue>START PREP ANYWAY</button>
  `;
  const retry = actions.querySelector<HTMLButtonElement>("[data-route-retry]");
  if (retry) {
    retry.onclick = () => {
      retry.disabled = true;
      retry.textContent = "RETRYING…";
      // The route runtime's retry timer is in-memory. Reloading preserves the saved run
      // but resets that timer, so route generation can be attempted immediately.
      window.location.reload();
    };
  }
  const continueButton = actions.querySelector<HTMLButtonElement>("[data-route-continue]");
  if (continueButton) {
    continueButton.onclick = () => {
      const primary = document.querySelector<HTMLButtonElement>(".running-briefing > .button.primary.full");
      primary?.click();
    };
  }
}

function activeFallback() {
  const session = loadRunSession();
  if (!session || session.stage !== "active" || loadPlannedRunningRoute(session.id)) return;
  const state = loadRunningRouteBuildState(session.id);
  if (state?.status !== "error") return;
  const dock = document.getElementById("zenchad-running-navigation-dock");
  if (!dock) return;
  const instruction = dock.querySelector<HTMLElement>("[data-running-nav-instruction]");
  const detail = dock.querySelector<HTMLElement>("[data-running-nav-detail]");
  const distance = dock.querySelector<HTMLElement>("[data-running-nav-distance]");
  if (instruction) instruction.textContent = "Run tracking is active";
  if (detail) {
    detail.textContent = session.mode === "story"
      ? "Route service unavailable · run rewards keep banking · Story routing will join if it recovers"
      : "Route service unavailable · GPS, time, XP and km rewards keep banking · retrying automatically";
  }
  if (distance) distance.textContent = "";
}

function tick() {
  briefingFallback();
  activeFallback();
}

export function startRunningRouteFallbackRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;
  const observer = new MutationObserver(tick);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(tick, 1100);
  queueMicrotask(tick);
}
