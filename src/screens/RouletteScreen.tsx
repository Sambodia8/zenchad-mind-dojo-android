import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction
} from "react";
import {
  BedDouble,
  Brain,
  Compass,
  Ear,
  Eye,
  Flame,
  Focus,
  Glasses,
  Heart,
  HeartHandshake,
  Headphones,
  Moon,
  Mountain,
  MoveUp,
  Orbit,
  Play,
  RotateCw,
  Sparkles,
  Triangle,
  Waves,
  Wind
} from "lucide-react";
import { MEDITATIONS } from "../data";
import type { AppData, Route } from "../types";
import { playUiSfx, stopUiSfx } from "../uiSfx";

interface Props {
  navigate: Dispatch<SetStateAction<Route>>;
  setData: Dispatch<SetStateAction<AppData>>;
  autoSpin?: boolean;
  uiSoundsEnabled: boolean;
}

const ORACLE_ICONS = [
  Heart,
  Headphones,
  Orbit,
  Moon,
  BedDouble,
  Wind,
  Sparkles,
  Ear,
  Focus,
  Brain,
  Glasses,
  Eye,
  Waves,
  Mountain,
  HeartHandshake,
  Flame,
  Compass
] as const;

const ORACLE_COLORS = [
  "#843d52",
  "#476b60",
  "#5c5c88",
  "#8a5b72",
  "#765c3c",
  "#3f6b78"
] as const;

export default function RouletteScreen({
  navigate,
  setData,
  autoSpin = false,
  uiSoundsEnabled
}: Props) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const spinningRef = useRef(false);
  const spinTimeoutRef = useRef<number | null>(null);
  const segmentAngle = 360 / MEDITATIONS.length;
  const selected = selectedIndex === null ? null : MEDITATIONS[selectedIndex];

  const spin = useCallback(() => {
    if (spinningRef.current) return;
    const index = Math.floor(Math.random() * MEDITATIONS.length);
    const desired = (360 - index * segmentAngle) % 360;
    const reducedMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.querySelector(".app-shell")?.classList.contains("reduce-motion") === true;
    setSelectedIndex(null);
    spinningRef.current = true;
    setSpinning(true);
    if (uiSoundsEnabled && !reducedMotion) playUiSfx("wheelSpin");
    setRotation((value) => {
      const current = ((value % 360) + 360) % 360;
      const delta = ((desired - current + 360) % 360) + 4 * 360;
      return value + delta;
    });
    navigator.vibrate?.(28);
    spinTimeoutRef.current = window.setTimeout(() => {
      setSelectedIndex(index);
      setData((currentData) => ({
        ...currentData,
        stats: {
          ...currentData.stats,
          rouletteSpins: currentData.stats.rouletteSpins + 1
        }
      }));
      spinningRef.current = false;
      setSpinning(false);
      navigator.vibrate?.([35, 28, 65]);
      stopUiSfx("wheelSpin");
      if (uiSoundsEnabled) playUiSfx("wheelLand");
    }, reducedMotion ? 220 : 2300);
  }, [segmentAngle, setData, uiSoundsEnabled]);

  useEffect(() => {
    if (!autoSpin) return;
    const autoSpinTimer = window.setTimeout(spin, 180);
    return () => window.clearTimeout(autoSpinTimer);
  }, [autoSpin, spin]);

  useEffect(
    () => () => {
      if (spinTimeoutRef.current !== null) window.clearTimeout(spinTimeoutRef.current);
      stopUiSfx("wheelSpin");
    },
    []
  );

  return (
    <div className="roulette-screen oracle-screen">
      <section className="oracle-intro">
        <span className="eyebrow">The brass oracle</span>
        <h1>Ask the dial</h1>
        <p>Let the symbols choose a practice.</p>
      </section>

      <div className="alethiometer-wrap">
        <Triangle className="oracle-pointer" aria-hidden="true" fill="currentColor" />
        <div
          className={`alethiometer-dial ${spinning ? "spinning" : ""}`}
          style={{ transform: `rotate(${rotation}deg)` }}
          role="img"
          aria-label={`Meditation dial with ${MEDITATIONS.length} practice symbols`}
        >
          <img
            className="alethiometer-face"
            src="/assets/roulette/alethiometer-dial.png"
            alt=""
            draggable={false}
          />
          <div className="oracle-symbols" aria-hidden="true">
            {MEDITATIONS.map((meditation, index) => {
              const Icon = ORACLE_ICONS[index] ?? Sparkles;
              const style = {
                "--symbol-angle": `${index * segmentAngle}deg`,
                "--symbol-color": ORACLE_COLORS[index % ORACLE_COLORS.length]
              } as CSSProperties;
              return (
                <span className="oracle-symbol" style={style} key={meditation.id}>
                  <Icon strokeWidth={1.9} />
                </span>
              );
            })}
          </div>
        </div>
        <MoveUp className="oracle-needle" aria-hidden="true" strokeWidth={1.25} />
        <span className="oracle-hub" aria-hidden="true">
          <img src="/assets/branding/eye-of-horus.png" alt="" />
        </span>
      </div>

      {!selected ? (
        <button
          className="button primary roulette-button"
          onClick={spin}
          disabled={spinning}
          data-sfx="none"
        >
          <RotateCw className={spinning ? "rotate" : ""} />
          {spinning ? "Reading the signs…" : "Turn the dial"}
        </button>
      ) : (
        <section className="oracle-result-card" aria-live="polite">
          <img className="oracle-result-art" src="/assets/roulette/lotus-result.png" alt="" />
          <div className="oracle-result-copy">
            <span>The needle points to</span>
            <h2>{selected.shortName}</h2>
            <p>{selected.benefit}</p>
          </div>
          <div className="oracle-result-actions">
            <button
              className="button primary"
              onClick={() => navigate({ name: "timer", meditationId: selected.id })}
            >
              <Play size={18} fill="currentColor" /> Begin practice
            </button>
            <button className="button ghost" onClick={spin} data-sfx="none">
              <RotateCw size={17} /> Turn again
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
