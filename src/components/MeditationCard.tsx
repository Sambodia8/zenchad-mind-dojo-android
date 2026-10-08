import { useState } from "react";
import { Clock3, ExternalLink, Heart, Moon, Wind, Headphones, Leaf, Music2, Waves, Orbit, Eye, Sparkles, Scan, Flame, Info, Play, ChevronUp, type LucideIcon } from "lucide-react";
import type { Meditation } from "../types";

const icons: Record<string, LucideIcon> = {
  heart: Heart, moon: Moon, wind: Wind, headphones: Headphones, leaf: Leaf,
  music: Music2, waves: Waves, orbit: Orbit, spiral: Orbit, eye: Eye,
  wave: Waves, coordinates: Scan, sparkles: Sparkles, flame: Flame
};

function artworkFor(meditation: Meditation) {
  if (meditation.id === "binaural") return "celestial";
  if (meditation.id === "diaphragmatic-breathing" || meditation.tags.includes("breathing")) return "sunset";
  if (meditation.category === "Emotional") return "lotus";
  if (meditation.category === "Relaxation" || meditation.tags.includes("sleep")) return "moon";
  return "celestial";
}

export default function MeditationCard({ meditation, onStart }: { meditation: Meditation; onStart: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = icons[meditation.icon] ?? Sparkles;
  const minutes = Math.ceil(meditation.phases.reduce((sum, phase) => sum + phase.duration, 0) / 60);
  const art = artworkFor(meditation);
  const detailsId = `meditation-details-${meditation.id}`;
  const hasGuided = Boolean(meditation.youtubeQuery) && meditation.id !== "binaural";

  return (
    <article className={`library-card library-card-${art}`} aria-labelledby={`meditation-title-${meditation.id}`}>
      <img className="library-card-art" src={`assets/meditation-art/${art}.webp`} alt="" loading="lazy" decoding="async" />
      <div className="library-card-heading">
        <span className="library-medallion" aria-hidden="true"><Icon strokeWidth={1.6} /></span>
        <div className="library-card-title">
          <div className="library-card-meta"><span>{meditation.category}</span><span className="library-duration"><Clock3 size={14} />{minutes} min</span></div>
          <h2 id={`meditation-title-${meditation.id}`}>{meditation.name}</h2>
        </div>
      </div>
      <p className="library-card-description">{meditation.description}</p>
      <div className="library-tags">{meditation.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
      <div className="library-card-actions">
        <button className="library-start" onClick={onStart} aria-label={`Start ${meditation.name}`}><Play size={21} />Start</button>
        {hasGuided ? <a className="library-secondary" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(meditation.youtubeQuery!)}`} target="_blank" rel="noreferrer"><ExternalLink size={17} />Guided</a>
          : meditation.id === "binaural" ? <button className="library-secondary" onClick={onStart}><Headphones size={17} />Playlists</button>
          : <button className="library-secondary" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)}><Info size={17} />{expanded ? "Close details" : "Details"}</button>}
      </div>
      {(hasGuided || meditation.id === "binaural") && <button className="library-details-toggle" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronUp size={14} /> : <Info size={14} />}{expanded ? "Close details" : "Practice details"}</button>}
      <div id={detailsId} className="library-card-details" hidden={!expanded}>
        <strong>{meditation.benefit}</strong>
        {meditation.breathingGuidance && <><h3>Breathing · {meditation.breathingGuidance.name}</h3><p>{meditation.breathingGuidance.instruction}</p><p>{meditation.breathingGuidance.safetyNote}</p></>}
        <ol>{meditation.phases.map((phase, index) => <li key={index}><strong>{phase.name} · {Math.floor(phase.duration / 60)}:{String(phase.duration % 60).padStart(2, "0")}</strong><p>{phase.instruction}</p></li>)}</ol>
      </div>
    </article>
  );
}
