import { Check, Clock3, Coins, Flame, LockKeyhole, Target, X } from "lucide-react";
import { useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import type { AppData, CosmeticSlot, ZenStatId } from "../types";
import { cosmeticById, cosmeticsForSlot, equipCosmetic, isCosmeticOwned, unequipCosmetic } from "../cosmetics";
import { purchaseFailureMessage, purchaseShopItem } from "../shop";
import {
  COSMETIC_SLOT_DEFINITIONS,
  flowXpForNextLevel,
  getStatLevelProgress,
  ZEN_STAT_LABELS,
  ZEN_STAT_ORDER
} from "../progression";

interface Props {
  data: AppData;
  setData?: Dispatch<SetStateAction<AppData>>;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function CharacterPortrait({ className = "" }: { className?: string }) {
  return <img className={`status-avatar-image ${className}`.trim()} src="assets/status/zen-chad-status.png" alt="Sam, ZenChad avatar" />;
}

const PAPER_DOLL_BASE_ASSET = "/assets/status/paper-doll/base/zenchad-canonical-underlayer-v3.png";
const ORIGINAL_PAPER_DOLL_ITEMS = ["runner-shorts", "red-trainers", "runner-top", "fitness-watch", "default-pink-hair"];

function PaperDollCharacter({ data }: Props) {
  const previewParams = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null;
  const previewTopId = previewParams?.get("paperDollTop");
  const previewHairId = previewParams?.get("paperDollHair");
  const previewWristId = previewParams?.get("paperDollWrist");
  const equipped = data.progression.equippedCosmetics;
  const topId = previewTopId ?? equipped.top;
  const wristId = previewWristId ?? equipped.wrist;
  const hairId = previewHairId ?? equipped.hair;
  const cosmeticIds = [equipped.legs, equipped.shoes, topId, wristId, hairId];
  const layers = cosmeticIds.map((id) => ({ id, definition: cosmeticById(id) }));
  if (equipped.aura !== "indigo-flow" || layers.some(({ definition }) => !definition?.paperDollLayer || !definition.paperDollRole)) {
    return <CharacterPortrait />;
  }
  if (cosmeticIds.every((id, index) => id === ORIGINAL_PAPER_DOLL_ITEMS[index])) {
    return <CharacterPortrait className="status-avatar-canonical" />;
  }

  return (
    <div className="status-avatar-stack" data-paper-doll-items={cosmeticIds.join(",")}>
      <img className="status-avatar-layer status-avatar-base" src={PAPER_DOLL_BASE_ASSET} alt="Sam, ZenChad avatar" />
      {layers.map(({ id, definition }) => definition?.paperDollLayer && definition.paperDollRole && (
        <img
          key={`${definition.paperDollRole}-${id}`}
          className={`status-avatar-layer status-avatar-wearable status-avatar-${definition.paperDollRole}`}
          data-paper-doll-layer={definition.paperDollRole}
          src={definition.paperDollLayer}
          alt=""
        />
      ))}
    </div>
  );
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

function CharacterPanel({ data }: Props) {
  return (
    <section className="status-character-panel" aria-label="ZenChad avatar">
      <PaperDollCharacter data={data} />
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
        <strong>Sam</strong>
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
  return (
    <section className="status-stats-panel">
      <PanelTitle>Zen Stats</PanelTitle>
      <div className="status-stat-list">
        {ZEN_STAT_ORDER.map((statId: ZenStatId) => {
          const progress = getStatLevelProgress(statId, data.progression.skillXp[statId] ?? 0);
          return (
            <div className="status-stat-row" key={statId}>
              <div className="status-stat-heading"><span>{ZEN_STAT_LABELS[statId]}</span><b>:</b><strong>{progress.level}</strong></div>
              <div className="status-stat-xp-track" role="progressbar" aria-label={`${ZEN_STAT_LABELS[statId]} level ${progress.level}: ${Math.round(progress.earnedWithinLevel)} of ${progress.xpForNextLevel} XP`} aria-valuenow={Math.round(progress.earnedWithinLevel)} aria-valuemin={0} aria-valuemax={progress.xpForNextLevel}>
                <span style={{ "--stat-progress": `${progress.progressPercent}%` } as CSSProperties} />
              </div>
            </div>
          );
        })}
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

function GearPreview({ slot, cosmeticId }: { slot: CosmeticSlot; cosmeticId: string }) {
  const item = cosmeticById(cosmeticId);
  if (item?.thumbnail) return <img className={`gear-preview-image gear-preview-${slot}`} src={item.thumbnail} alt="" />;
  return <span className={`gear-preview-glyph gear-preview-${slot}`} aria-hidden="true">{COSMETIC_SLOT_DEFINITIONS.find((item) => item.slot === slot)?.glyph}</span>;
}

function GearSlots({ data, onOpen }: Props & { onOpen: (slot: CosmeticSlot) => void }) {
  return (
    <section className="status-gear-panel">
      <div className="status-gear-grid">
        {COSMETIC_SLOT_DEFINITIONS.map(({ slot, label }) => (
          <button
            type="button"
            className="status-gear-slot"
            key={slot}
            onClick={() => onOpen(slot)}
            aria-label={`Choose ${label.toLowerCase()} cosmetic`}
          >
            <span className="status-gear-label">{label}</span>
            <span className="status-gear-preview"><GearPreview slot={slot} cosmeticId={data.progression.equippedCosmetics[slot]} /></span>
            <small>{data.progression.equippedCosmetics[slot]}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

interface WardrobeDialogProps {
  slot: CosmeticSlot;
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  onClose: () => void;
}

function WardrobeDialog({ slot, data, setData, onClose }: WardrobeDialogProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const slotLabel = COSMETIC_SLOT_DEFINITIONS.find((item) => item.slot === slot)?.label ?? slot;
  const items = cosmeticsForSlot(slot);
  const equippedId = data.progression.equippedCosmetics[slot];

  const buy = (itemId: string) => setData((current) => {
    const result = purchaseShopItem(current, itemId);
    setFeedback(result.ok ? `${result.item.name} unlocked. Choose Equip when you want to wear it.` : purchaseFailureMessage(result.reason));
    return result.data;
  });

  const equip = (itemId: string) => {
    setData((current) => equipCosmetic(current, itemId));
    setFeedback(`${cosmeticById(itemId)?.name ?? "Cosmetic"} equipped.`);
  };

  const unequip = (itemId: string) => {
    setData((current) => unequipCosmetic(current, itemId));
    setFeedback(`${cosmeticById(itemId)?.name ?? "Cosmetic"} unequipped.`);
  };

  return createPortal(
    <div className="wardrobe-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="wardrobe-dialog" role="dialog" aria-modal="true" aria-labelledby="wardrobe-title">
        <header className="wardrobe-heading">
          <div><span>Wardrobe</span><h2 id="wardrobe-title">Choose {slotLabel}</h2></div>
          <div className="wardrobe-balance"><Coins size={16} /><strong>{data.zenPoints} ZP</strong></div>
          <button type="button" className="wardrobe-close" onClick={onClose} aria-label="Close wardrobe"><X /></button>
        </header>
        <div className="wardrobe-options">
          {items.map((item) => {
            const owned = isCosmeticOwned(data, item.id);
            const equipped = equippedId === item.id;
            const canAfford = item.shopPrice !== undefined && data.zenPoints >= item.shopPrice;
            return (
              <article className={`wardrobe-option ${equipped ? "equipped" : ""} ${owned ? "owned" : "locked"}`} key={item.id}>
                <div className="wardrobe-option-image">
                  {item.thumbnail ? <img src={item.thumbnail} alt="" /> : <span className="wardrobe-missing-art">Artwork<br />pending</span>}
                </div>
                <div className="wardrobe-option-copy">
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <small>{item.starter ? "Starter item" : owned ? "Owned" : `${item.shopPrice} ZP`}</small>
                </div>
                {equipped && !item.starter ? (
                  <button type="button" onClick={() => unequip(item.id)}>Unequip</button>
                ) : equipped ? (
                  <button type="button" disabled><Check size={15} /> Equipped</button>
                ) : owned ? (
                  <button type="button" onClick={() => equip(item.id)}>Equip</button>
                ) : (
                  <button type="button" className="buy" onClick={() => buy(item.id)} disabled={!canAfford}>
                    <LockKeyhole size={14} /> {canAfford ? `Buy · ${item.shopPrice} ZP` : `Need ${item.shopPrice} ZP`}
                  </button>
                )}
              </article>
            );
          })}
        </div>
        {feedback ? <p className="wardrobe-feedback" role="status">{feedback}</p> : null}
      </section>
    </div>,
    document.body
  );
}

export default function ProgressScreen({ data, setData }: Props) {
  const [openSlot, setOpenSlot] = useState<CosmeticSlot | null>(null);
  return (
    <div className="status-screen">
      <div className="status-main-board">
        <div className="status-left-column">
          <SummaryPanel data={data} />
          <FlowGauge data={data} />
          <ZenStatsPanel data={data} />
          <ProgressStatsPanel data={data} />
        </div>
        <CharacterPanel data={data} />
      </div>
      <GearSlots data={data} onOpen={setOpenSlot} />
      <section className="status-flavour"><span className="status-flavour-seal">◉</span><p>Stay consistent. <strong>Unlock your highest self.</strong></p></section>
      {openSlot && setData ? <WardrobeDialog slot={openSlot} data={data} setData={setData} onClose={() => setOpenSlot(null)} /> : null}
    </div>
  );
}
