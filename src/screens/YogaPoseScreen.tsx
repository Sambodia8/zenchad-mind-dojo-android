import type { Dispatch, SetStateAction } from "react";
import { Clock, Play } from "lucide-react";
import { STRETCHES } from "../data";
import type { Route } from "../types";
import MovementVisual from "../components/MovementVisual";

interface Props {
  movementId: string;
  navigate: Dispatch<SetStateAction<Route>>;
}

export default function YogaPoseScreen({ movementId, navigate }: Props) {
  const movement = STRETCHES.find((item) => item.id === movementId) ?? STRETCHES[0];
  const seconds = Math.min(30, movement.seconds);

  return (
    <div className="screen-stack">
      <section className="stretch-detail">
        <MovementVisual movement={movement} />
        <span className="eyebrow">Yoga with Mark · Pose guide</span>
        <h1>{movement.name}</h1>
        <div className="detail-time">
          <Clock size={17} /> Up to {seconds} seconds {movement.sides ? "per side" : ""}
        </div>
        <p>{movement.cue}</p>
      </section>
      <section className="card sensation-card">
        <div className={`sensation-key ${movement.sensationKind}`}>
          <span />
          {movement.sensationKind === "stretch"
            ? "Where you should feel it"
            : "What should be working"}
        </div>
        <strong>{movement.sensationCue}</strong>
        <div className="muscle-chips">
          {movement.muscleGroups.map((muscle) => (
            <span key={muscle}>{muscle}</span>
          ))}
        </div>
      </section>
      <section className="card safety-note">
        <strong>Comfort beats depth.</strong>
        <p>Move slowly, breathe normally, and stop if you feel sharp pain, numbness or dizziness.</p>
      </section>
      <button
        className="button primary full"
        onClick={() => navigate({ name: "yoga-class", classId: "daily-reset" })}
      >
        <Play size={18} /> Join Mark&apos;s Daily Reset
      </button>
    </div>
  );
}
