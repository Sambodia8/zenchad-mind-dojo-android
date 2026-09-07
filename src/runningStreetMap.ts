import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?url";
import type { RunPoint } from "./running";
import type { RunningNavigationState } from "./runningNavigation";
import type { PlannedRunningRoute } from "./runningRouteStore";

const OPENFREEMAP_DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";
const states = new WeakMap<HTMLElement, {
  map: import("maplibre-gl").Map;
  marker: import("maplibre-gl").Marker;
  routeIdentity: string;
  loaded: boolean;
  errors: number;
}>();

function bearingDegrees(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const fromLat = from.lat * Math.PI / 180;
  const toLat = to.lat * Math.PI / 180;
  const deltaLng = (to.lng - from.lng) * Math.PI / 180;
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function runnerHeading(points: RunPoint[], route: PlannedRunningRoute, shapeIndex: number) {
  const latest = points.at(-1);
  if (typeof latest?.heading === "number" && Number.isFinite(latest.heading)) return (latest.heading % 360 + 360) % 360;
  if (latest) {
    for (let index = points.length - 2; index >= 0; index -= 1) {
      const previous = points[index];
      if (Math.abs(latest.lat - previous.lat) + Math.abs(latest.lng - previous.lng) >= .00002) return bearingDegrees(previous, latest);
    }
  }
  const current = route.geometry[Math.max(0, Math.min(route.geometry.length - 1, shapeIndex))];
  const next = route.geometry[Math.min(route.geometry.length - 1, shapeIndex + 1)] ?? route.geometry[Math.max(0, shapeIndex - 1)];
  return current && next ? bearingDegrees(current, next) : 0;
}

function lineFeature(points: Array<{ lat: number; lng: number }>) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: points.map((point) => [point.lng, point.lat])
    }
  };
}

function sourceData(map: import("maplibre-gl").Map, sourceId: string, points: Array<{ lat: number; lng: number }>) {
  const source = map.getSource(sourceId) as import("maplibre-gl").GeoJSONSource | undefined;
  if (source) source.setData(lineFeature(points));
}

function fitRoute(map: import("maplibre-gl").Map, route: PlannedRunningRoute) {
  if (!route.geometry.length) return;
  let west = route.geometry[0].lng;
  let east = west;
  let south = route.geometry[0].lat;
  let north = south;
  for (const point of route.geometry) {
    west = Math.min(west, point.lng);
    east = Math.max(east, point.lng);
    south = Math.min(south, point.lat);
    north = Math.max(north, point.lat);
  }
  map.fitBounds([[west, south], [east, north]], { padding: 40, duration: 0, maxZoom: 16 });
}

function updateMap(
  container: HTMLElement,
  state: NonNullable<ReturnType<typeof states.get>>,
  route: PlannedRunningRoute,
  navigation: RunningNavigationState,
  points: RunPoint[]
) {
  if (!state.loaded || state.errors >= 3 || !points.length) return;
  const split = Math.max(0, Math.min(route.geometry.length - 1, navigation.nearestShapeIndex));
  sourceData(state.map, "zenchad-remaining", route.geometry.slice(split));
  sourceData(state.map, "zenchad-completed", route.geometry.slice(0, split + 1));
  const latest = points[points.length - 1];
  state.marker
    .setLngLat([latest.lng, latest.lat])
    .setRotation(runnerHeading(points, route, navigation.nearestShapeIndex));
  const identity = `${route.sessionId}:${route.createdAt}:${route.rerouteCount}`;
  if (identity !== state.routeIdentity) {
    state.routeIdentity = identity;
    fitRoute(state.map, route);
  }
  container.classList.add("ready");
}

/** Online street context enhancement. The sibling SVG remains visible until this reports ready. */
export async function updateRunningStreetMap(
  container: HTMLElement,
  route: PlannedRunningRoute,
  navigation: RunningNavigationState,
  points: RunPoint[]
) {
  const existing = states.get(container);
  if (existing) {
    updateMap(container, existing, route, navigation, points);
    return;
  }

  container.classList.remove("ready", "failed");
  try {
    const maplibregl = await import("maplibre-gl");
    if (!container.isConnected || states.has(container)) return;
    // Use MapLibre's separately bundled worker. The default blob worker is
    // produced from the minified application chunk and fails in Android
    // WebView ("ReferenceError: Lt is not defined"), leaving a black canvas.
    maplibregl.setWorkerUrl(maplibreWorkerUrl);
    const markerElement = document.createElement("span");
    markerElement.className = "running-street-runner";
    markerElement.setAttribute("aria-hidden", "true");
    const map = new maplibregl.Map({
      container,
      style: OPENFREEMAP_DARK_STYLE,
      center: [route.start.lng, route.start.lat],
      zoom: 14,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0
    });
    map.addControl(new maplibregl.AttributionControl({
      compact: true,
      customAttribution: '<a href="https://openfreemap.org/" target="_blank">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'
    }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 86, unit: "metric" }), "bottom-left");
    const marker = new maplibregl.Marker({ element: markerElement, rotationAlignment: "map" })
      .setLngLat([route.start.lng, route.start.lat])
      .addTo(map);
    const state = {
      map,
      marker,
      routeIdentity: `${route.sessionId}:${route.createdAt}:${route.rerouteCount}`,
      loaded: false,
      errors: 0
    };
    states.set(container, state);
    map.once("load", () => {
      if (!container.isConnected) return;
      map.addSource("zenchad-remaining", { type: "geojson", data: lineFeature(route.geometry) });
      map.addSource("zenchad-completed", { type: "geojson", data: lineFeature(route.geometry.slice(0, 1)) });
      map.addLayer({ id: "zenchad-route-casing", type: "line", source: "zenchad-remaining", paint: { "line-color": "#17110a", "line-width": 10, "line-opacity": .78 } });
      map.addLayer({ id: "zenchad-route-remaining", type: "line", source: "zenchad-remaining", paint: { "line-color": "#f2c94c", "line-width": 6 } });
      map.addLayer({ id: "zenchad-route-completed", type: "line", source: "zenchad-completed", paint: { "line-color": "#2f9cff", "line-width": 6 } });
      state.loaded = true;
      // The street map is deliberately hidden until its style is ready so the
      // schematic remains the visual fallback. MapLibre therefore initialises
      // against a zero-sized container on Android WebView. Reveal it first,
      // then resize and fit on the next frame or the camera remains centred on
      // the runner with the route and surrounding streets outside the canvas.
      container.classList.add("ready");
      requestAnimationFrame(() => {
        if (!container.isConnected) return;
        map.resize();
        fitRoute(map, route);
        updateMap(container, state, route, navigation, points);
      });
    });
    map.on("error", () => {
      state.errors += 1;
      if (!state.loaded || state.errors >= 3) {
        container.classList.add("failed");
        container.classList.remove("ready");
      }
    });
  } catch {
    container.classList.add("failed");
    container.classList.remove("ready");
  }
}
