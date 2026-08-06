import type { Dispatch, SetStateAction } from "react";
import { Check, Lock, Palette } from "lucide-react";
import type { AppData, AppPreferences } from "../types";

interface Props {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
}

const themes: Array<{
  id: AppPreferences["selectedTheme"];
  name: string;
  note: string;
  unlockAt: number;
}> = [
  { id: "dawn", name: "Lotus Dawn", note: "Ivory, lavender and warm peach", unlockAt: 0 },
  { id: "forest", name: "Forest Sanctuary", note: "Sage leaves and quiet turquoise", unlockAt: 1 },
  { id: "rain", name: "Rain Temple", note: "Dusty blue after the clouds", unlockAt: 2 },
  { id: "moon", name: "Moonlit Dojo", note: "Soft lavender, never neon", unlockAt: 4 },
  { id: "ember", name: "Ember Cave", note: "Warm terracotta and antique gold", unlockAt: 6 }
];

export default function ThemesScreen({ data, setData }: Props) {
  const choose = (id: AppPreferences["selectedTheme"]) => {
    setData((current) => ({ ...current, preferences: { ...current.preferences, selectedTheme: id } }));
  };

  return (
    <div className="screen-stack themes-screen">
      <section className="page-intro">
        <span className="eyebrow">Unlockable atmosphere</span>
        <h1>Watercolour themes</h1>
        <p>Every theme keeps text and controls clear. Only the illustrated washes change.</p>
      </section>

      <div className="theme-gallery">
        {themes.map((theme) => {
          const unlocked = data.stats.sessionsCompleted >= theme.unlockAt;
          const selected = data.preferences.selectedTheme === theme.id;
          return (
            <button
              key={theme.id}
              className={`theme-card theme-${theme.id} ${selected ? "selected" : ""}`}
              onClick={() => unlocked && choose(theme.id)}
              disabled={!unlocked}
            >
              <span className="theme-preview" />
              <span className="theme-copy">
                <strong>{theme.name}</strong>
                <small>{unlocked ? theme.note : `Unlocks after ${theme.unlockAt} sessions`}</small>
              </span>
              <span className="theme-state">{selected ? <Check /> : unlocked ? <Palette /> : <Lock />}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
