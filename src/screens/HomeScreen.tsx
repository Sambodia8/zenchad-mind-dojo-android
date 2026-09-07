import { useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowLeft,
  Bike,
  Footprints,
  MoonStar,
  NotebookPen,
  PersonStanding,
  type LucideIcon
} from "lucide-react";
import type { Route } from "../types";

interface Props {
  navigate: Dispatch<SetStateAction<Route>>;
}

interface HomePath {
  label: string;
  detail: string;
  className: string;
  icon: LucideIcon;
  route?: Route;
  action?: "movement-choice";
}

const homePaths: HomePath[] = [
  {
    label: "Move",
    detail: "Run or ride",
    className: "move",
    icon: PersonStanding,
    action: "movement-choice"
  },
  {
    label: "Stretch",
    detail: "Yoga & mobility",
    className: "stretch",
    icon: PersonStanding,
    route: { name: "yoga" }
  },
  {
    label: "Meditate",
    detail: "Guided practices",
    className: "meditate",
    icon: MoonStar,
    route: { name: "library", tab: "meditations" }
  },
  {
    label: "Reflect",
    detail: "Journal & plan",
    className: "reflect",
    icon: NotebookPen,
    route: { name: "journal" }
  },
];

export default function HomeScreen({ navigate }: Props) {
  const [movementChoiceOpen, setMovementChoiceOpen] = useState(false);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="home-dojo-screen">
      <section className="home-dojo-hero" aria-labelledby="home-dojo-title">
        <img src="assets/home/zen-chad-embodied-eyes-hero.png" alt="" />
        <p className="home-dojo-greeting">{greeting}, Sam</p>
        <div className="home-dojo-title-lockup">
          <span>Today in the</span>
          <h1 id="home-dojo-title">Dojo</h1>
        </div>
      </section>

      <section className="home-paths" aria-labelledby="home-paths-title">
        <div className="home-paths-heading">
          <span aria-hidden="true" />
          <h2 id="home-paths-title">What would help right now?</h2>
        </div>

        {movementChoiceOpen ? (
          <section className="home-movement-choice" aria-labelledby="movement-choice-title">
            <button type="button" className="home-movement-back" onClick={() => setMovementChoiceOpen(false)}>
              <ArrowLeft /> Back
            </button>
            <div>
              <h2 id="movement-choice-title">How do you want to move?</h2>
              <p>Choose a run or a ride. Stretching has its own space on Home.</p>
            </div>
            <div className="home-movement-choice-grid">
              <button type="button" onClick={() => navigate({ name: "running" })}>
                <Footprints />
                <span><strong>Run</strong><small>Quick, Story, or Just Run</small></span>
              </button>
              <button type="button" onClick={() => navigate({ name: "bike-quest" })}>
                <Bike />
                <span><strong>Ride</strong><small>Bike Quest</small></span>
              </button>
            </div>
          </section>
        ) : (
          <div className="home-path-grid">
          {homePaths.map(({ label, detail, className, icon: Icon, route, action }) => (
            <button
              key={label}
              type="button"
              className={`home-path-card ${className}`}
              onClick={() => action === "movement-choice" ? setMovementChoiceOpen(true) : route && navigate(route)}
            >
              <span className="home-path-icon" aria-hidden="true"><Icon /></span>
              <span className="home-path-copy">
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
            </button>
          ))}
          </div>
        )}
      </section>
    </div>
  );
}
