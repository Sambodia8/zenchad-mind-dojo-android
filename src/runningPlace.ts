import { Capacitor, registerPlugin } from "@capacitor/core";
import { routeNameFromRunPoints, type RunPoint, type RunRecord } from "./running";

const RunningPlace = registerPlugin<{ lookup(point: { lat: number; lng: number }): Promise<{ name?: string }> }>("RunningPlace");

export function needsRunPlaceName(record: RunRecord) {
  return record.routeNameSource !== "user" && !record.routeRoadNames.length
    && /^(Recorded route|Just Run)$/i.test(record.routeName) && record.points.length > 0;
}

export async function resolveRunPlaceName(points: RunPoint[], lookup = async (point: RunPoint) => {
  if (Capacitor.getPlatform() !== "android") return undefined;
  return (await RunningPlace.lookup({ lat: point.lat, lng: point.lng })).name;
}) {
  const existing = routeNameFromRunPoints(points);
  if (existing.roadNames.length) return existing;
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
    && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && p.accuracy <= 60);
  const named: RunPoint[] = [];
  const sampled = new Set<number>();
  for (const fraction of [0, 1 / 3, 2 / 3]) {
    if (!valid.length) break;
    const index = Math.floor((valid.length - 1) * fraction);
    if (sampled.has(index)) continue;
    sampled.add(index);
    try {
      const name = await lookup(valid[index]);
      if (name) named.push({ ...valid[index], roadName: name.slice(0, 120) });
    } catch { /* Offline/unavailable: retain the fallback and retry on a later visit. */ }
  }
  // These points are already sampled. Sampling their thirds again can discard
  // the final place (and older compacted tracks may lack distance metadata).
  const roadNames: string[] = [];
  for (const point of named) {
    const name = routeNameFromRunPoints([point]).roadNames[0];
    if (name && !roadNames.some((saved) => saved.localeCompare(name, undefined, { sensitivity: "accent" }) === 0)) roadNames.push(name);
  }
  return { routeName: roadNames.join(" · ") || "Recorded route", roadNames };
}
