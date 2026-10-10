import { Check, ChevronDown, Clock3, ExternalLink, Footprints, Play, Volume2, VolumeX } from "lucide-react";
import type { YogaClass, YogaClassSlide } from "../types";
import { getYogaClassDuration } from "../data";
import { getClassPresentation } from "../yogaPresentation";
import MovementVisual from "./MovementVisual";
import "../guidedClassIntro.css";

export interface ClassSoundtrack {
  id: string;
  name: string;
  artwork: string;
}

interface Props {
  yogaClass: YogaClass;
  slides: YogaClassSlide[];
  tracks: readonly ClassSoundtrack[];
  selectedTrack: string;
  musicEnabled: boolean;
  volume: number;
  onTrack: (id: string) => void;
  onToggleMusic: () => void;
  onVolume: (volume: number) => void;
  confirmed: boolean;
  onConfirm: (confirmed: boolean) => void;
  onStart: () => void;
  onSkip?: () => void;
  skipLabel?: string;
}

const durationLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export default function GuidedClassIntro({ yogaClass, slides, tracks, selectedTrack, musicEnabled, volume,
  onTrack, onToggleMusic, onVolume, confirmed, onConfirm, onStart, onSkip, skipLabel }: Props) {
  const presentation = getClassPresentation(yogaClass);
  const blocked = Boolean(yogaClass.safetyGate && !confirmed);
  return (
    <div className="guided-class-intro" data-atmosphere={presentation.atmosphere}>
      <section className="class-intro-hero" aria-labelledby="class-intro-title">
        <img src={presentation.image} alt={presentation.imageAlt} fetchPriority="high" />
        <div className="class-intro-heading">
          <span className="class-intro-context">{presentation.context}</span>
          <h1 id="class-intro-title">{yogaClass.name}</h1>
        </div>
      </section>

      <div className="class-intro-body">
        <div className="class-intro-stats" aria-label="Class statistics">
          <span><Clock3 size={18} aria-hidden="true" /> <b>{durationLabel(getYogaClassDuration(yogaClass))}</b></span>
          <span><Footprints size={18} aria-hidden="true" /> <b>{slides.length} {slides.length === 1 ? "movement" : "movements"}</b></span>
        </div>
        <p className="class-intro-description">{yogaClass.description}</p>
        {yogaClass.id === "before-run" ? <p className="class-intro-warning">If knee pain appears or worsens, choose a gentler option or stop.</p> : null}

        {yogaClass.safetyGate ? (
          <section className="class-intro-safety" aria-labelledby="recovery-title">
            <h2 id="recovery-title">Not for a new or acute injury</h2>
            <p>Do not begin if you have severe or worsening pain, cannot bear weight, have numbness, a changed shape or colour, or major swelling. Seek medical advice instead.</p>
            <a href={yogaClass.sourceUrl} target="_blank" rel="noreferrer">NHS sprain and strain guidance <ExternalLink size={14} /></a>
            <label>
              <input type="checkbox" checked={confirmed} onChange={event => onConfirm(event.target.checked)} />
              <span>My soreness is mild, recovering, and comfortable enough for gentle movement.</span>
            </label>
          </section>
        ) : null}

        <details className="class-intro-evidence">
          <summary><ChevronDown size={18} aria-hidden="true" /> Why this class?</summary>
          <p>{yogaClass.evidence}</p>
          {yogaClass.sourceUrl ? <a href={yogaClass.sourceUrl} target="_blank" rel="noreferrer">Read the guidance <ExternalLink size={14} /></a> : null}
        </details>

        <section className="class-intro-movements" aria-labelledby="movement-preview-title">
          <h2 id="movement-preview-title">Movement preview</h2>
          <ol className="class-intro-carousel class-movement-carousel" tabIndex={0} aria-label="Movement sequence" >
            {slides.map((slide, index) => (
              <li key={`${slide.movement.id}-${index}`} data-movement-id={slide.movement.id} data-side={slide.side}>
                <div className="class-movement-art"><MovementVisual movement={slide.movement} mirrored={slide.side === 2} compact /></div>
                <span className="class-movement-position">{slide.stepNumber}{slide.side ? ` · Side ${slide.side}` : ""}</span>
                <strong>{slide.label ?? slide.movement.name}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section className="class-intro-soundtrack" aria-labelledby="soundtrack-title">
          <div className="class-soundtrack-heading">
            <h2 id="soundtrack-title">Soundtrack</h2>
            <button type="button" className="class-music-toggle" aria-pressed={musicEnabled} onClick={onToggleMusic}>
              {musicEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />} Music {musicEnabled ? "on" : "off"}
            </button>
          </div>
          <div className="class-intro-carousel class-track-carousel" aria-label="Stretching soundtrack">
            {tracks.map(track => {
              const selected = musicEnabled && selectedTrack === track.id;
              return <button type="button" key={track.id} className="class-track" aria-pressed={selected} onClick={() => onTrack(track.id)}>
                <span className="class-track-art"><img src={track.artwork} alt="" loading="lazy" />{selected ? <span className="class-track-check"><Check size={14} /></span> : null}</span>
                <strong>{track.name}</strong>
              </button>;
            })}
          </div>
          <label className="class-intro-volume"><span>Volume</span><input type="range" min="0" max="70" value={volume} onChange={event => onVolume(Number(event.target.value))} aria-label="Stretching music volume" /><output>{volume}%</output></label>
        </section>
      </div>

      <div className="class-intro-actions">
        <button type="button" className="class-intro-start" onClick={onStart} disabled={blocked} aria-describedby={blocked ? "class-safety-required" : undefined}>
          <Play size={19} fill="currentColor" aria-hidden="true" />{presentation.action}<span aria-hidden="true">›</span>
        </button>
        {blocked ? <span id="class-safety-required">Confirm the safety check above to begin.</span> : null}
        {onSkip ? <button type="button" className="class-intro-skip" onClick={onSkip}>{skipLabel}</button> : null}
      </div>
    </div>
  );
}
