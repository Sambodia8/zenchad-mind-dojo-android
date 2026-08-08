import { useEffect, useState } from "react";
import { Sparkles, Trophy, X } from "lucide-react";
import type { AppData } from "../types";
import { playUiSfx } from "../uiSfx";

interface Props {
  data: AppData;
  onDismiss: (newLevel: number) => void;
}

export default function LevelUpModal({ data, onDismiss }: Props) {
  const [show, setShow] = useState(false);
  const currentLevel = Math.floor(data.stats.xp / 1000) + 1;

  useEffect(() => {
    if (currentLevel > data.stats.lastSeenLevel) {
      // Small delay to allow main screen to render first
      const t = setTimeout(() => {
        setShow(true);
        playUiSfx("reward");
      }, 500);
      return () => clearTimeout(t);
    }
  }, [currentLevel, data.stats.lastSeenLevel]);

  if (!show) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 1000, 
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div className="card" style={{ 
        margin: '2rem', padding: '2rem', 
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        background: 'var(--card-bg)', border: '2px solid var(--brand)',
        animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <div style={{ padding: '1rem', background: 'var(--brand)', borderRadius: '50%', color: 'white', marginBottom: '1rem' }}>
          <Trophy size={48} />
        </div>
        <span className="eyebrow" style={{ color: 'var(--brand)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
          <Sparkles size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.25rem' }} />
          Level Up!
        </span>
        <h2 style={{ fontSize: '2.5rem', margin: '0 0 1rem 0' }}>Level {currentLevel}</h2>
        <p style={{ opacity: 0.8, marginBottom: '2rem' }}>
          Your consistent practice is paying off. Keep building those mind reps!
        </p>
        <button 
          className="button primary full" 
          onClick={() => {
            setShow(false);
            onDismiss(currentLevel);
          }}
        >
          <X size={18} /> Continue
        </button>
      </div>
    </div>
  );
}
