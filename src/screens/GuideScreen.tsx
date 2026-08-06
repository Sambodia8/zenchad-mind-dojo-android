import { useState, type Dispatch, type SetStateAction } from "react";
import { ArrowRight, Mic, Sparkles } from "lucide-react";
import { MEDITATIONS } from "../data";
import type { Route } from "../types";
import MeditationIcon from "../components/MeditationIcon";

interface Props {
  navigate: Dispatch<SetStateAction<Route>>;
}

const needs = [
  { label: "I need deep rest", id: "nsdr" },
  { label: "My mind is racing", id: "pratyahara" },
  { label: "I feel emotionally full", id: "acceptance" },
  { label: "I want a little joy", id: "frisson" },
  { label: "Help me focus", id: "trataka" }
];

export default function GuideScreen({ navigate }: Props) {
  const [selectedId, setSelectedId] = useState("nsdr");
  const selected = MEDITATIONS.find((item) => item.id === selectedId)!;

  return (
    <div className="screen-stack guide-screen">
      <section className="guide-portrait">
        <img src="assets/vision2/zen-chad-mascot.png" alt="Zen Chad, your meditation guide" />
        <span className="guide-status">Here with you</span>
      </section>

      <section className="chat-stack" aria-live="polite">
        <div className="chat-bubble guide">
          <strong>Zen Chad</strong>
          <p>No need to explain the whole day. What would feel helpful in the next few minutes?</p>
        </div>
        <div className="guide-choices">
          {needs.map((need) => (
            <button
              className={selectedId === need.id ? "active" : ""}
              key={need.id}
              onClick={() => setSelectedId(need.id)}
            >
              {need.label}
            </button>
          ))}
        </div>
        <div className="chat-bubble guide recommendation-bubble">
          <MeditationIcon meditationId={selected.id} />
          <div>
            <small>I might try</small>
            <strong>{selected.name}</strong>
            <p>{selected.description}</p>
          </div>
        </div>
      </section>

      <button className="button primary full" onClick={() => navigate({ name: "timer", meditationId: selected.id })}>
        <Sparkles size={18} /> Begin gently <ArrowRight size={18} />
      </button>
      <button className="button ghost full" onClick={() => navigate({ name: "library" })}>
        <Mic size={18} /> I would rather browse
      </button>
    </div>
  );
}
