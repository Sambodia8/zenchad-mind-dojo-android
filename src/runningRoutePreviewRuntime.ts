import { loadRunSession } from "./running";
import { navigationArrowForManeuver, navigationStateForLocation } from "./runningNavigation";
import { loadPlannedRunningRoute, type PlannedRunningRoute } from "./runningRouteStore";
import { updateRunningStreetMap } from "./runningStreetMap";

const PREVIEW_ID = "zenchad-running-route-preview";
let started = false;
let activeNearestIndex = 0;

function tracePoints(route: PlannedRunningRoute, endShapeIndex = route.geometry.length - 1) {
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
  return points.slice(0, Math.max(0, endShapeIndex) + 1).map((point) => {
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

function svgPositionForPoint(route: PlannedRunningRoute, point: { lat: number; lng: number }) {
  const lats = route.geometry.map((item) => item.lat);
  const lngs = route.geometry.map((item) => item.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    x: Math.max(3, Math.min(97, 7 + (point.lng - minLng) / Math.max(0.00001, maxLng - minLng) * 86)),
    y: Math.max(3, Math.min(97, 93 - (point.lat - minLat) / Math.max(0.00001, maxLat - minLat) * 86))
  };
}

function bearingDegrees(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const fromLat = from.lat * Math.PI / 180;
  const toLat = to.lat * Math.PI / 180;
  const deltaLng = (to.lng - from.lng) * Math.PI / 180;
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/** GPS heading first, then recent movement, then the route direction as a stable fallback. */
export function runnerHeadingDegrees(
  points: Array<{ lat: number; lng: number; heading?: number | null }>,
  route: PlannedRunningRoute,
  shapeIndex: number
) {
  const latest = points[points.length - 1];
  if (typeof latest?.heading === "number" && Number.isFinite(latest.heading)) {
    return (latest.heading % 360 + 360) % 360;
  }
  if (latest) {
    for (let index = points.length - 2; index >= 0; index -= 1) {
      const previous = points[index];
      if (Math.abs(latest.lat - previous.lat) + Math.abs(latest.lng - previous.lng) >= 0.00002) {
        return bearingDegrees(previous, latest);
      }
    }
  }
  const currentRoutePoint = route.geometry[Math.max(0, Math.min(route.geometry.length - 1, shapeIndex))];
  const nextRoutePoint = route.geometry[Math.min(route.geometry.length - 1, shapeIndex + 1)]
    ?? route.geometry[Math.max(0, shapeIndex - 1)];
  return currentRoutePoint && nextRoutePoint ? bearingDegrees(currentRoutePoint, nextRoutePoint) : 0;
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
  const session = loadRunSession();
  const latest = session?.points[session.points.length - 1];
  if (!latest) return;
  const state = navigationStateForLocation(route, { lat: latest.lat, lng: latest.lng }, activeNearestIndex);
  activeNearestIndex = state.nearestShapeIndex;
  const arrow = dock.querySelector<HTMLElement>(".running-nav-arrow");
  if (arrow) arrow.textContent = navigationArrowForManeuver(state.nextManeuver);
  const current = svgPositionForPoint(route, latest);
  if (!current) return;
  const start = svgPosition(route, 0);
  const finish = svgPosition(route, route.geometry.length - 1);
  const heading = runnerHeadingDegrees(session.points, route, state.nearestShapeIndex);

  let map = dock.querySelector<SVGSVGElement>(".running-navigation-mini-map");
  if (!map) {
    map = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    map.setAttribute("class", "running-navigation-mini-map");
    map.setAttribute("viewBox", "0 0 100 100");
    map.setAttribute("aria-label", "Full running route. Gold is ahead, blue is completed, and the blue arrow shows your position and facing direction.");
    map.setAttribute("role", "img");
    map.setAttribute("preserveAspectRatio", "xMidYMid meet");
    dock.appendChild(map);
  }
  let streetMap = dock.querySelector<HTMLElement>(".running-street-map");
  if (!streetMap) {
    streetMap = document.createElement("div");
    streetMap.className = "running-street-map";
    streetMap.setAttribute("aria-label", "Dark street map with road names, completed route in blue, remaining route in gold, north and scale.");
    map.insertAdjacentElement("afterend", streetMap);
  }
  void updateRunningStreetMap(streetMap, route, state, session.points);
  map.innerHTML = `
    <defs>
      <filter id="running-route-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter>
    </defs>
    <text class="running-map-north" x="94" y="10" text-anchor="middle">N</text>
    <polyline class="running-route-planned" points="${tracePoints(route)}"></polyline>
    <polyline class="running-route-travelled" points="${tracePoints(route, state.nearestShapeIndex)}"></polyline>
    ${start ? `<circle class="running-route-endpoint running-route-start" cx="${start.x.toFixed(1)}" cy="${start.y.toFixed(1)}" r="3.2"></circle>` : ""}
    ${finish ? `<circle class="running-route-endpoint running-route-finish" cx="${finish.x.toFixed(1)}" cy="${finish.y.toFixed(1)}" r="3.6"></circle>` : ""}
    <g class="running-runner-marker" data-heading="${Math.round(heading)}" transform="translate(${current.x.toFixed(1)} ${current.y.toFixed(1)}) rotate(${heading.toFixed(1)})" filter="url(#running-route-glow)">
      <circle class="running-runner-halo" r="9.5"></circle>
      <circle class="running-runner-dot" r="6.5"></circle>
      <path class="running-runner-heading" d="M 0 -5.2 L 4.2 4 L 0 2.2 L -4.2 4 Z"></path>
    </g>`;
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
  window.addEventListener("storage", tick);
  window.setInterval(tick, 1000);
  queueMicrotask(tick);
}
