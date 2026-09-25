import { useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowLeft,
  Bike,
  ChevronDown,
  Footprints,
  MoonStar,
  NotebookPen,
  PersonStanding,
  type LucideIcon
} from "lucide-react";
import type { Route } from "../types";
import { refreshZenCoachNotification } from "../zenCoachNotifications";
import {
  getDailyZenCoachRecommendation,
  loadZenCoachProfile,
  recordZenCoachDecision,
  saveZenCoachProfile,
  saveAcceptedZenCoachPlan,
  type ZenCoachPlan
} from "../zenCoach";

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
  const [adventureOptionsOpen, setAdventureOptionsOpen] = useState(false);
  const [restAcknowledged, setRestAcknowledged] = useState(false);
  const [snoozed, setSnoozed] = useState(false);
  const [recommendation] = useState(() => getDailyZenCoachRecommendation());
  const coachVisible = loadZenCoachProfile().coachStyle !== "off";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const rememberDecision = (plan: ZenCoachPlan, decision: "accepted" | "rejected" | "rest" | "snoozed", reason?: string) => {
    saveZenCoachProfile(recordZenCoachDecision(loadZenCoachProfile(), plan, decision, undefined, reason));
    void refreshZenCoachNotification();
  };

  const startAdventure = (plan: ZenCoachPlan, fallbackReason?: string) => {
    const decision = plan.activity === "rest" ? "rest" : "accepted";
    rememberDecision(plan, decision, fallbackReason);
    saveAcceptedZenCoachPlan(plan.activity === "rest" ? null : plan);

    if (plan.activity === "run") {
      navigate({ name: "running" });
    } else if (plan.activity === "bike") {
      navigate({ name: "bike-quest" });
    } else {
      setSnoozed(false);
      setRestAcknowledged(true);
      setAdventureOptionsOpen(false);
    }
  };

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

      <section className="home-adventure-card" aria-labelledby="home-adventure-title">
        <div className="home-adventure-heading">
          <span className={`home-adventure-mark${coachVisible ? "" : " off"}`} aria-hidden="true" />
          <div>
            <span className="home-adventure-eyebrow">{coachVisible ? "Circuit's pick" : "Today's adventure"}</span>
            <h2 id="home-adventure-title">{restAcknowledged ? snoozed ? "We'll leave it for tomorrow" : "Rest is part of the plan" : recommendation.primary.title}</h2>
          </div>
          <span className="home-adventure-progress" aria-label={`${recommendation.weekly.completed} of ${recommendation.weekly.target} sessions this rolling week`}>
            {recommendation.weekly.completed}/{recommendation.weekly.target}
          </span>
        </div>

        <div className="home-adventure-progress-track" aria-hidden="true">
          {Array.from({ length: recommendation.weekly.target }, (_, index) => (
            <span key={index} className={index < recommendation.weekly.completed ? "is-complete" : ""} />
          ))}
        </div>

        {restAcknowledged ? (
          <p className="home-adventure-reason">{snoozed ? "Reminders are paused until tomorrow. Open the app whenever you choose." : "No catch-up required. Come back when movement feels useful."}</p>
        ) : (
          <p className="home-adventure-reason"><strong>Why this:</strong> {recommendation.primary.reason}</p>
        )}

        {!restAcknowledged ? (
          <div className="home-adventure-actions">
            <button type="button" className="home-adventure-primary" onClick={() => startAdventure(recommendation.primary)}>
              {recommendation.primary.activity === "rest" ? "Take a quiet rest" : `Let's ${recommendation.primary.activity === "bike" ? "ride" : "run"}`}
            </button>
            <button
              type="button"
              className="home-adventure-options"
              onClick={() => setAdventureOptionsOpen((open) => !open)}
              aria-expanded={adventureOptionsOpen}
            >
              Change plan <ChevronDown aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button type="button" className="home-adventure-options home-adventure-reset" onClick={() => { setRestAcknowledged(false); setSnoozed(false); }}>
            See today's pick
          </button>
        )}

        {adventureOptionsOpen && !restAcknowledged ? (
          <div className="home-adventure-options-panel" aria-label="Quieter alternatives">
            <button type="button" onClick={() => { rememberDecision(recommendation.primary, "rejected", "shorter"); startAdventure(recommendation.fallbacks.b, "shorter"); }}>
              <span><strong>Make it shorter</strong><small>{recommendation.fallbacks.b.title}</small></span>
              <em>{recommendation.fallbacks.b.minutes} min</em>
            </button>
            <button type="button" onClick={() => { rememberDecision(recommendation.primary, "rejected", "tired"); startAdventure(recommendation.fallbacks.c, "tired"); }}>
              <span><strong>Keep it gentle</strong><small>{recommendation.fallbacks.c.title}</small></span>
              <em>{recommendation.fallbacks.c.activity === "rest" ? "No pressure" : `${recommendation.fallbacks.c.minutes} min`}</em>
            </button>
            <button type="button" className="home-adventure-rest-option" onClick={() => { rememberDecision(recommendation.primary, "rest"); saveAcceptedZenCoachPlan(null); setRestAcknowledged(true); setAdventureOptionsOpen(false); }}>
              Not today
            </button>
            <button type="button" className="home-adventure-rest-option" onClick={() => { rememberDecision(recommendation.primary, "snoozed"); saveAcceptedZenCoachPlan(null); setSnoozed(true); setRestAcknowledged(true); setAdventureOptionsOpen(false); }}>
              Remind me tomorrow
            </button>
          </div>
        ) : null}
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
