import { Clock3, Flame, Target } from "lucide-react";
import type { AppData, ZenStatId } from "../types";
import {
  COSMETIC_SLOT_DEFINITIONS,
  flowXpForNextLevel,
  ZEN_STAT_LABELS,
  ZEN_STAT_ORDER
} from "../progression";

interface Props {
  data: AppData;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function CharacterPortrait({ className = "" }: { className?: string }) {
  return <img className={`status-avatar-image ${className}`.trim()} src="assets/status/zen-chad-status.png" alt="Sam, ZenChad avatar" />;
}

function PanelTitle({ children }: { children: string }) {
  return (
    <div className="status-panel-title">
      <i />
      <span>{children}</span>
      <i />
    </div>
  );
}

function CharacterPanel() {
  return (
    <section className="status-character-panel" aria-label="ZenChad avatar">
      <CharacterPortrait />
    </section>
  );
}

function SummaryPanel({ data }: Props) {
  const { stats, progression } = data;
  return (
    <section className="status-summary-panel">
      <div className="status-portrait-frame">
        <CharacterPortrait className="status-portrait" />
      </div>
      <div className="status-summary-copy">
        <strong>SAM</strong>
        <span><b>Lv</b><em>{stats.level}</em></span>
        <span><b>Flow</b><em>{progression.flowXp}/{flowXpForNextLevel(progression.flowLevel)}</em></span>
        <span><b>XP</b><em>{stats.xp}</em></span>
      </div>
    </section>
  );
}

function FlowGauge({ data }: Props) {
  const { progression } = data;
  const max = flowXpForNextLevel(progression.flowLevel);
  const percent = Math.min(100, (progression.flowXp / max) * 100);
  return (
    <section className="status-flow-panel">
      <div className="status-flow-label"><span>Flow</span></div>
      <div className="status-flow-track" role="progressbar" aria-valuenow={progression.flowXp} aria-valuemin={0} aria-valuemax={max} aria-label="Flow progress">
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="status-flow-next"><span>To Next Flow Lv:</span><b>{max - progression.flowXp}</b></div>
    </section>
  );
}

function ZenStatsPanel({ data }: Props) {
  const stats = data.progression.skillLevels;
  return (
    <section className="status-stats-panel">
      <PanelTitle>Zen Stats</PanelTitle>
      <div className="status-stat-list">
        {ZEN_STAT_ORDER.map((statId: ZenStatId) => (
          <div className="status-stat-row" key={statId}>
            <span>{ZEN_STAT_LABELS[statId]}</span><b>:</b><strong>{stats[statId] ?? 1}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProgressStatsPanel({ data }: Props) {
  const { stats } = data;
  return (
    <section className="status-progress-panel">
      <PanelTitle>Progress</PanelTitle>
      <div className="status-progress-list">
        <div><span className="status-progress-icon xp">XP</span><span>Total XP</span><b>{stats.xp}</b></div>
        <div><span className="status-progress-icon sessions"><Target size={15} /></span><span>Sessions</span><b>{stats.sessionsCompleted}</b></div>
        <div><span className="status-progress-icon time"><Clock3 size={15} /></span><span>Total Time</span><b>{formatTime(stats.totalSeconds)}</b></div>
        <div><span className="status-progress-icon streak"><Flame size={15} /></span><span>Streak</span><b>{stats.streak} day{stats.streak === 1 ? "" : "s"}</b></div>
      </div>
    </section>
  );
}

const GEAR_ASSET_BY_SLOT: Record<string, string> = {
  head: "/assets/status/generated/core/head-magenta-spiky-hair.png",
  top: "/assets/status/generated/core/top-charcoal-training-shirt.png",
  wrist: "/assets/status/generated/effects/fitness-smartwatch.png",
  legs: "/assets/status/generated/core/legs-charcoal-training-shorts.png",
  shoes: "/assets/status/generated/core/shoes-black-magenta-trainers.png",
  aura: "/assets/status/generated/effects/violet-spiritual-flame-aura.png"
};

function GearPreview({ slot }: { slot: string }) {
  const src = GEAR_ASSET_BY_SLOT[slot];
  if (src) return <img className={`gear-preview-image gear-preview-${slot}`} src={src} alt="" />;
  return <span className={`gear-preview-glyph gear-preview-${slot}`} aria-hidden="true">{COSMETIC_SLOT_DEFINITIONS.find((item) => item.slot === slot)?.glyph}</span>;
}

function GearSlots({ data }: Props) {
  return (
    <section className="status-gear-panel">
      <PanelTitle>Mind Dojo Gear</PanelTitle>
      <div className="status-gear-grid">
        {COSMETIC_SLOT_DEFINITIONS.map(({ slot, label }) => (
          <div className="status-gear-slot" key={slot}>
            <span className="status-gear-label">{label}</span>
            <div className="status-gear-preview"><GearPreview slot={slot} /></div>
            <small>{data.progression.equippedCosmetics[slot]}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ProgressScreen({ data }: Props) {
  return (
    <div className="status-screen">
      <div className="status-main-board">
        <div className="status-left-column">
          <SummaryPanel data={data} />
          <FlowGauge data={data} />
          <ZenStatsPanel data={data} />
          <ProgressStatsPanel data={data} />
        </div>
        <CharacterPanel />
      </div>
      <GearSlots data={data} />
      <section className="status-flavour"><span className="status-flavour-seal">◉</span><p>Stay consistent.<br /><strong>Unlock your highest self.</strong></p></section>
    </div>
  );
}
