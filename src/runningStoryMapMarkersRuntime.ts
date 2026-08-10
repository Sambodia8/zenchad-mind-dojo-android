import {
  loadRunSession,
  loadRunningProfile,
  trimRouteForPrivacy,
  type RunPoint,
  type RunRecord
} from "./running";
import { storyResultForRun, type StoryRouteEvent } from "./runningStoryResults";

const SVG_NS = "http://www.w3.org/2000/svg";
const MARKER_CLASS = "running-story-map-marker";
const LEGEND_CLASS = "running-story-map-legend";
let started = false;

function nearestPointByDistance(points: RunPoint[], distanceMeters: number) {
  if (!points.length) return null;
  return points.reduce((best, point) =>
    Math.abs((point.distanceFromStart ?? 0) - distanceMeters) < Math.abs((best.distanceFromStart ?? 0) - distanceMeters)
      ? point
      : best
  );
}

function eventPosition(displayedPoints: RunPoint[], event: StoryRouteEvent) {
  if (displayedPoints.length < 2) return null;
  const firstDistance = displayedPoints[0].distanceFromStart ?? 0;
  const lastDistance = displayedPoints[displayedPoints.length - 1].distanceFromStart ?? firstDistance;
  if (event.distanceMeters < firstDistance - 25 || event.distanceMeters > lastDistance + 25) return null;

  const target = nearestPointByDistance(displayedPoints, event.distanceMeters);
  if (!target) return null;
  const lats = displayedPoints.map((point) => point.lat);
  const lngs = displayedPoints.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(0.00001, maxLat - minLat);
  const lngRange = Math.max(0.00001, maxLng - minLng);
  return {
    x: 8 + ((target.lng - minLng) / lngRange) * 84,
    y: 92 - ((target.lat - minLat) / latRange) * 84
  };
}

function markerLabel(event: StoryRouteEvent) {
  if (event.type === "chase-start") return "Pursuit began";
  if (event.type === "chase-outcome") {
    if (event.detail === "escaped") return "Pursuit broken";
    if (event.detail === "pressure") return "Pursuer stayed with you";
    if (event.detail === "caught-branch") return "Intercepted · mission branched";
    return "Pursuit outcome";
  }
  if (event.type === "helicopter-start") return "Helicopter acquired visual";
  if (event.type === "helicopter-cover") return "Helicopter visual broken";
  return event.detail || "Story event";
}

function markerKind(event: StoryRouteEvent) {
  return event.type.startsWith("helicopter") ? "air" : "chase";
}

function appendMarker(svg: SVGSVGElement, displayedPoints: RunPoint[], event: StoryRouteEvent, index: number) {
  const position = eventPosition(displayedPoints, event);
  if (!position) return false;
  const kind = markerKind(event);
  const marker = kind === "air"
    ? document.createElementNS(SVG_NS, "circle")
    : document.createElementNS(SVG_NS, "rect");
  marker.classList.add(MARKER_CLASS, `running-story-map-marker-${kind}`);
  marker.setAttribute("data-story-event", event.type);
  if (marker instanceof SVGCircleElement) {
    marker.setAttribute("cx", position.x.toFixed(1));
    marker.setAttribute("cy", position.y.toFixed(1));
    marker.setAttribute("r", "3.2");
  } else {
    marker.setAttribute("x", (position.x - 2.8).toFixed(1));
    marker.setAttribute("y", (position.y - 2.8).toFixed(1));
    marker.setAttribute("width", "5.6");
    marker.setAttribute("height", "5.6");
    marker.setAttribute("rx", "1");
    marker.setAttribute("transform", `rotate(45 ${position.x.toFixed(1)} ${position.y.toFixed(1)})`);
  }
  const title = document.createElementNS(SVG_NS, "title");
  title.textContent = `${index + 1}. ${markerLabel(event)}`;
  marker.appendChild(title);
  svg.appendChild(marker);
  return true;
}

function addLegend(container: HTMLElement, events: StoryRouteEvent[]) {
  container.querySelector(`.${LEGEND_CLASS}`)?.remove();
  if (!events.length) return;
  const legend = document.createElement("div");
  legend.className = LEGEND_CLASS;
  const unique = Array.from(new Set(events.map((event) => markerKind(event))));
  legend.innerHTML = unique.map((kind) => `
    <span><i class="running-story-marker-key running-story-marker-key-${kind}"></i>${kind === "air" ? "Air unit" : "Pursuit"}</span>
  `).join("");
  container.appendChild(legend);
}

function annotateTrace(container: HTMLElement, record: RunRecord, displayedPoints: RunPoint[]) {
  const result = storyResultForRun(record.id);
  const events = result?.events ?? [];
  const svg = container.querySelector<SVGSVGElement>("svg");
  if (!svg || displayedPoints.length < 2) return;
  svg.querySelectorAll(`.${MARKER_CLASS}`).forEach((node) => node.remove());
  const visibleEvents = events.filter((event, index) => appendMarker(svg, displayedPoints, event, index));
  addLegend(container, visibleEvents);
}

function annotateSummary() {
  const session = loadRunSession();
  if (!session || session.stage !== "complete") return;
  const profile = loadRunningProfile();
  const record = profile.history.find((item) => item.id === session.id);
  const container = document.querySelector<HTMLElement>(".running-results-card .running-route-trace");
  if (!record || !container) return;
  annotateTrace(container, record, trimRouteForPrivacy(record.points, profile.privacyRadiusMeters));
}

function annotateHistory() {
  const history = loadRunningProfile().history;
  const details = Array.from(document.querySelectorAll<HTMLElement>(".running-history-detail"));
  details.forEach((detail, index) => {
    const record = history[index];
    const container = detail.querySelector<HTMLElement>(".running-route-trace");
    if (!record || !container) return;
    annotateTrace(container, record, record.points);
  });
}

function tick() {
  annotateSummary();
  annotateHistory();
}

export function startRunningStoryMapMarkersRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;
  const observer = new MutationObserver(tick);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", tick);
  window.setInterval(tick, 1800);
  queueMicrotask(tick);
}
