import type { PlannedRunningRoute } from "./runningRouteStore";
import type { StoryRouteAnchor, StoryAnchorKind } from "./runningStory";

interface TraceEdge {
  begin_shape_index?: number;
  end_shape_index?: number;
  use?: string;
  tunnel?: boolean;
  indoor?: boolean;
  internal_intersection?: boolean;
  traffic_signal?: boolean;
  max_downward_grade?: number;
  end_node?: {
    type?: string;
    intersecting_edges?: unknown[];
  };
}

interface TraceAttributesResponse {
  edges?: TraceEdge[];
  error?: string;
  status_message?: string;
}

const DEFAULT_BASE_URL = "https://valhalla.openstreetmap.de";
const NO_ELEVATION = 32768;

function routeDistanceAt(route: PlannedRunningRoute, shapeIndex: number | undefined) {
  if (!route.cumulativeMeters.length) return 0;
  const index = Math.max(0, Math.min(route.cumulativeMeters.length - 1, shapeIndex ?? 0));
  return route.cumulativeMeters[index] ?? 0;
}

function anchor(
  kind: StoryAnchorKind,
  distanceMeters: number,
  confidence: number,
  id: string,
  label?: string
): StoryRouteAnchor {
  return { id, kind, distanceMeters: Math.max(0, distanceMeters), confidence, label };
}

function isSteepDownhill(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value) || Math.abs(value) >= NO_ELEVATION) return false;
  // Valhalla exposes the maximum downward slope; deployments have represented it as either
  // a signed slope or a positive magnitude, so treat an 8+ magnitude as a meaningful descent.
  return Math.abs(value) >= 8;
}

function maneuverAnchors(route: PlannedRunningRoute): StoryRouteAnchor[] {
  return route.maneuvers
    .filter((maneuver, index) => index > 0 && index < route.maneuvers.length - 1)
    .map((maneuver) => anchor(
      "junction",
      maneuver.routeDistanceMeters,
      0.92,
      `maneuver-${maneuver.id}`,
      "navigation junction"
    ));
}

function edgeAnchors(route: PlannedRunningRoute, edges: TraceEdge[]) {
  const result: StoryRouteAnchor[] = [];

  edges.forEach((edge, index) => {
    const begin = routeDistanceAt(route, edge.begin_shape_index);
    const end = routeDistanceAt(route, edge.end_shape_index);
    const middle = begin + Math.max(0, end - begin) / 2;
    const use = (edge.use ?? "").toLowerCase();

    if (use === "steps" || use === "stairs") {
      result.push(anchor("stairs", begin, 0.99, `stairs-${index}-start`, "steps"));
      result.push(anchor("stairs", middle, 0.99, `stairs-${index}-mid`, "steps"));
      result.push(anchor("stairs", end, 0.99, `stairs-${index}-end`, "steps"));
    }

    if (edge.internal_intersection) {
      result.push(anchor("junction", begin, 0.96, `internal-junction-${index}`, "mapped intersection"));
    }

    if (edge.traffic_signal) {
      result.push(anchor("road-crossing", end, 0.9, `signal-${index}`, "traffic signal"));
    }

    if (isSteepDownhill(edge.max_downward_grade)) {
      result.push(anchor("steep-descent", begin, 0.9, `descent-${index}-start`, "steep descent"));
      result.push(anchor("steep-descent", middle, 0.9, `descent-${index}-mid`, "steep descent"));
      result.push(anchor("steep-descent", end, 0.9, `descent-${index}-end`, "steep descent"));
    }

    // A mapped tunnel or indoor passage is a high-confidence fictional cover opportunity.
    // We do not infer "cover" from ordinary buildings/roads or uncertain map geometry.
    if ((edge.tunnel || edge.indoor) && end - begin >= 30) {
      result.push(anchor("cover", Math.min(end, begin + 20), 0.9, `cover-${index}-entry`, edge.tunnel ? "tunnel" : "indoor passage"));
      result.push(anchor("cover", middle, 0.9, `cover-${index}-middle`, edge.tunnel ? "tunnel" : "indoor passage"));
    }
  });

  return result;
}

function mergeNearbyAnchors(anchors: StoryRouteAnchor[]) {
  const ordered = [...anchors].sort((a, b) => a.distanceMeters - b.distanceMeters || b.confidence - a.confidence);
  const result: StoryRouteAnchor[] = [];

  for (const candidate of ordered) {
    const nearby = result.find((existing) =>
      existing.kind === candidate.kind && Math.abs(existing.distanceMeters - candidate.distanceMeters) < 18
    );
    if (!nearby) result.push(candidate);
    else if (candidate.confidence > nearby.confidence) Object.assign(nearby, candidate);
  }
  return result;
}

export async function annotateRunningRouteSemantics(
  route: PlannedRunningRoute,
  baseUrl = import.meta.env.VITE_VALHALLA_BASE_URL || DEFAULT_BASE_URL
): Promise<StoryRouteAnchor[]> {
  const basic = maneuverAnchors(route);
  if (route.geometry.length < 2) return basic;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/trace_attributes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shape: route.geometry.map((point) => ({ lat: point.lat, lon: point.lng })),
        costing: "pedestrian",
        shape_match: "edge_walk",
        filters: {
          action: "include",
          attributes: [
            "edge.begin_shape_index",
            "edge.end_shape_index",
            "edge.use",
            "edge.tunnel",
            "edge.indoor",
            "edge.internal_intersection",
            "edge.traffic_signal",
            "edge.max_downward_grade"
          ]
        }
      })
    });
    if (!response.ok) return mergeNearbyAnchors(basic);
    const payload = await response.json() as TraceAttributesResponse;
    if (!Array.isArray(payload.edges)) return mergeNearbyAnchors(basic);
    return mergeNearbyAnchors([...basic, ...edgeAnchors(route, payload.edges)]);
  } catch {
    // Semantic annotation is enrichment. Navigation must remain usable when the public
    // attribution endpoint is temporarily unavailable.
    return mergeNearbyAnchors(basic);
  }
}

export function badAccelerationAnchorNear(
  anchors: StoryRouteAnchor[],
  routeProgressMeters: number,
  lookBehindMeters = 35,
  lookAheadMeters = 140
) {
  const blockedKinds = new Set<StoryAnchorKind>(["junction", "road-crossing", "steep-descent", "stairs"]);
  return anchors.find((candidate) =>
    blockedKinds.has(candidate.kind) &&
    candidate.confidence >= 0.75 &&
    candidate.distanceMeters >= routeProgressMeters - lookBehindMeters &&
    candidate.distanceMeters <= routeProgressMeters + lookAheadMeters
  ) ?? null;
}

export function nextStoryCoverAnchor(anchors: StoryRouteAnchor[], routeProgressMeters: number) {
  return anchors
    .filter((candidate) =>
      candidate.kind === "cover" &&
      candidate.confidence >= 0.8 &&
      candidate.distanceMeters > routeProgressMeters + 80 &&
      candidate.distanceMeters < routeProgressMeters + 900
    )
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] ?? null;
}
