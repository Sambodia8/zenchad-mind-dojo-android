import { loadRunSession } from "./running";
import { navigationStateForLocation } from "./runningNavigation";
import { loadPlannedRunningRoute, type PlannedRunningRoute } from "./runningRouteStore";

const PREVIEW_ID = "zenchad-running-route-preview";
let started = false;
let activeNearestIndex = 0;

function tracePoints(route: PlannedRunningRoute) {
  const points = route.geometry;
  if (points.length < 2) return "";
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(0.00001, maxLat - minLat);
  const lngRange = Math.max(0.00001, maxLng - minLng);
  return points.map((point) => {
    const x = 7 + (point.lng - minLng) / lngRange * 86;
    const y = 93 - (point.lat - minLat) / latRange * 86;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function svgPosition(route: PlannedRunningRoute, shapeIndex: number) {
  const point = route.geometry[Math.max(0, Math.min(route.geometry.length - 1, shapeIndex))];
  if (!point) return null;
  const lats = route.geometry.map((item) => item.lat);
  const lngs = route.geometry.map((item) => item.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    x: 7 + (point.lng - minLng) / Math.max(0.00001, maxLng - minLng) * 86,
    y: 93 - (point.lat - minLat) / Math.max(0.00001, maxLat - minLat) * 86
  };
}

function arrowForInstruction(instruction: string) {
  const copy = instruction.toLowerCase();
  if (copy.includes("u-turn") || copy.includes("uturn")) return "↶";
  if (copy.includes("roundabout") || copy.includes("rotary")) return "↻";
  if (copy.includes("sharp left")) return "↙";
  if (copy.includes("sharp right")) return "↘";
  if (copy.includes("left")) return "↰";
  if (copy.includes("right")) return "↱";
  if (copy.includes("arrive") || copy.includes("destination")) return "◆";
  return "↑";
}

function renderBriefingPreview(route: PlannedRunningRoute) {
  const briefing = document.querySelector<HTMLElement>(".running-briefing");
  if (!briefing) {
    document.getElementById(PREVIEW_ID)?.remove();
    return;
  }
  let preview = document.getElementById(PREVIEW_ID);
  if (!preview) {
    preview = document.createElement("section");
    preview.id = PREVIEW_ID;
    preview.className = "running-route-preview";
    const note = briefing.querySelector(".running-route-note");
    if (note) briefing.insertBefore(preview, note);
    else briefing.appendChild(preview);
  }
  const trace = tracePoints(route);
  preview.innerHTML = `
    <div class="running-route-preview-copy">
      <span class="eyebrow">Zenchad picked this route</span>
      <strong>${(route.distanceMeters / 1000).toFixed(1)} km · about ${Math.round(route.estimatedMinutes)} min</strong>
      <small>${route.reasons.slice(0, 2).join(" · ") || (route.mode === "story" ? "Built for Story Run opportunities" : "Balanced for a low-friction run")}</small>
    </div>
    <svg viewBox="0 0 100 100" role="img" aria-label="Chosen running route preview">
      <polyline points="${trace}"></polyline>
      <circle class="running-route-start" cx="${trace ? trace.split(" ")[0].split(",")[0] : 7}" cy="${trace ? trace.split(" ")[0].split(",")[1] : 93}" r="3"></circle>
    </svg>
  `;
}

function removeBriefingPreview() {
  document.getElementById(PREVIEW_ID)?.remove();
}

function renderActiveMiniMap(route: PlannedRunningRoute) {
  const dock = document.querySelector<HTMLElement>(".running-navigation-dock");
  if (!dock) return;
  const instruction = dock.querySelector<HTMLElement>("[data-running-nav-instruction]")?.textContent ?? "";
  const arrow = dock.querySelector<HTMLElement>(".running-nav-arrow");
  if (arrow) arrow.textContent = arrowForInstruction(instruction);

  const session = loadRunSession();
  const latest = session?.points[session.points.length - 1];
  if (!latest) return;
  const state = navigationStateForLocation(route, { lat: latest.lat, lng: latest.lng }, activeNearestIndex);
  activeNearestIndex = state.nearestShapeIndex;
  const current = svgPosition(route, state.nearestShapeIndex);
  if (!current) return;

  let map = dock.querySelector<SVGSVGElement>(".running-navigation-mini-map");
  if (!map) {
    map = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    map.setAttribute("class", "running-navigation-mini-map");
    map.setAttribute("viewBox", "0 0 100 100");
    map.setAttribute("aria-label", "Current position on the running route");
    map.setAttribute("role", "img");
    dock.appendChild(map);
  }
  map.innerHTML = `<polyline points="${tracePoints(route)}"></polyline><circle cx="${current.x.toFixed(1)}" cy="${current.y.toFixed(1)}" r="4"></circle>`;
}

function tick() {
  const session = loadRunSession();
  if (!session) {
    removeBriefingPreview();
    return;
  }
  const route = loadPlannedRunningRoute(session.id);
  if (!route) {
    removeBriefingPreview();
    return;
  }
  if (session.stage === "briefing") renderBriefingPreview(route);
  else removeBriefingPreview();
  if (session.stage === "active") renderActiveMiniMap(route);
}

export function startRunningRoutePreviewRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;
  const observer = new MutationObserver(tick);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", tick);
  window.setInterval(tick, 1000);
  queueMicrotask(tick);
}
