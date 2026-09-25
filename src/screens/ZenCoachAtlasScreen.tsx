import { Heart, MapPinned, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { RunRecord } from "../running";
import { atlasRediscoverySuggestion, buildZenCoachAtlas, loadZenCoachAtlasState, saveZenCoachAtlasState, type AtlasPlace } from "../zenCoachAtlas";
import "../zenCoachAtlas.css";

export interface ZenCoachAtlasScreenProps {
  /** Pass completed records from loadRunningProfile().history. */
  records: RunRecord[];
  routePrivacyMeters: number;
  /** Persist a favourite change through the running profile owned by the caller. */
  onFavoriteChange?: (runIds: string[], isFavorite: boolean) => void;
}

const DAY = 86_400_000;

function dateLabel(at: number) {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(at);
}

function distanceLabel(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10_000 ? 0 : 1)} km` : `${Math.round(meters)} m`;
}

function visitLabel(place: AtlasPlace) {
  return place.visitCount === 1 ? "1 completed visit" : `${place.visitCount} completed visits`;
}

function rediscoveryLabel(place: AtlasPlace) {
  const days = Math.max(0, Math.floor((Date.now() - place.lastVisitedAt) / DAY));
  if (place.rediscovery === "forgotten") return `A real route you have not visited for ${Math.max(6, Math.round(days / 7))} weeks.`;
  if (place.rediscovery === "ready") return `Last visited ${days} days ago; it is ready to revisit when it suits you.`;
  return "A recent completed route in your private history.";
}

function PrivateTrace({ place }: { place: AtlasPlace }) {
  const points = place.previewPoints;
  if (points.length < 2) return <div className="atlas-safe-preview"><MapPinned size={18} /><span>Visit card only</span><small>No GPS trace available</small></div>;
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const spanLat = Math.max(0.00001, maxLat - minLat), spanLng = Math.max(0.00001, maxLng - minLng);
  const trace = points.map((point) => `${(8 + ((point.lng - minLng) / spanLng) * 84).toFixed(1)},${(92 - ((point.lat - minLat) / spanLat) * 84).toFixed(1)}`).join(" ");
  return <figure className="atlas-trace"><svg viewBox="0 0 100 100" role="img" aria-label={`Privacy-trimmed, non-navigable shape from a completed visit to ${place.name}`}><polyline points={trace} /></svg><figcaption>Private visit shape · not a map or directions</figcaption></figure>;
}

export default function ZenCoachAtlasScreen({ records, routePrivacyMeters, onFavoriteChange }: ZenCoachAtlasScreenProps) {
  const [atlas, setAtlas] = useState(loadZenCoachAtlasState);
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const places = useMemo(() => buildZenCoachAtlas(records, routePrivacyMeters), [records, routePrivacyMeters]);
  const shown = filter === "favorites" ? places.filter((place) => place.isFavorite) : places;
  const suggestion = atlasRediscoverySuggestion(places);
  const setEnabled = (enabled: boolean) => {
    const next = { enabled };
    saveZenCoachAtlasState(next);
    setAtlas(next);
  };

  if (!atlas.enabled) return <div className="screen-stack zen-coach-atlas"><section className="atlas-intro card"><span className="atlas-icon"><MapPinned /></span><span className="eyebrow">Zen Coach · private feature</span><h1>Adventure Atlas</h1><p>See places created from your completed GPS runs. ZenChad keeps the history on this device and trims each preview around your private start and finish.</p><button className="button primary" onClick={() => setEnabled(true)}>Turn on my private Atlas</button><small><ShieldCheck size={14} /> No public map, route sharing, generated track, or rewards.</small></section></div>;

  return <div className="screen-stack zen-coach-atlas">
    <section className="atlas-intro"><span className="eyebrow">Zen Coach · personal history</span><h1>Adventure Atlas</h1><p>Completed runs you chose to record, grouped into private places. It does not create new routes or provide directions.</p><button className="atlas-disable" onClick={() => setEnabled(false)}>Turn Atlas off</button></section>
    {suggestion ? <section className="atlas-rediscovery card"><Sparkles /><div><span className="eyebrow">Rediscover</span><h2>{suggestion.name}</h2><p>{rediscoveryLabel(suggestion)}</p><small>{visitLabel(suggestion)} · last visit {dateLabel(suggestion.lastVisitedAt)}</small></div></section> : null}
    <div className="atlas-filter" role="tablist" aria-label="Adventure Atlas places"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All places</button><button className={filter === "favorites" ? "active" : ""} onClick={() => setFilter("favorites")}>Favourites</button></div>
    {shown.length ? <div className="atlas-place-list">{shown.map((place) => <article className="atlas-place card" key={place.id}><PrivateTrace place={place} /><div className="atlas-place-copy"><div className="atlas-place-heading"><div><span className="eyebrow">{visitLabel(place)}</span><h2>{place.name}</h2></div><button className={place.isFavorite ? "is-favorite" : ""} disabled={!onFavoriteChange} aria-label={`${place.isFavorite ? "Remove" : "Add"} ${place.name} ${place.isFavorite ? "from" : "to"} favourites`} aria-pressed={place.isFavorite} onClick={() => onFavoriteChange?.(place.visits.map((visit) => visit.id), !place.isFavorite)}><Heart fill={place.isFavorite ? "currentColor" : "none"} /></button></div><p>Last visit {dateLabel(place.lastVisitedAt)} · {distanceLabel(place.totalDistanceMeters)} recorded across visits</p><small>{place.isFavorite ? "Saved favourite" : "Private completed place"} · {place.previewPoints.length >= 2 ? "trimmed preview" : "no GPS preview"}</small><details><summary>Visit history</summary><ul>{place.visits.map((visit) => <li key={visit.id}>{dateLabel(visit.endedAt)} · {distanceLabel(visit.distanceMeters)}</li>)}</ul></details></div></article>)}</div> : <section className="atlas-empty card"><MapPinned /><h2>{filter === "favorites" ? "No favourite places yet" : "No completed places yet"}</h2><p>{filter === "favorites" ? "Save a completed route as a favourite from Run history." : "After a completed run has GPS points, it can appear here as a private visit."}</p></section>}
  </div>;
}
