import { useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  ExternalLink,
  ListChecks,
  Play,
  Sparkles
} from "lucide-react";
import { getYogaClassDuration, YOGA_CLASSES } from "../data";
import type { AppData, Route } from "../types";

interface Props {
  data: AppData;
  navigate: Dispatch<SetStateAction<Route>>;
}

type YogaMode = "choose" | "classes";

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

export default function YogaScreen({ data, navigate }: Props) {
  const [mode, setMode] = useState<YogaMode>("choose");

  if (mode === "choose") {
    return (
      <div className="screen-stack yoga-screen yoga-choice-screen">
        <section className="yoga-hero">
          <div>
            <span className="eyebrow">Movement with Mark</span>
            <h1>How do you want to move?</h1>
            <p>
              Follow a class built for a moment in your day, or choose every pose yourself and
              make a flow that feels right today.
            </p>
          </div>
          <img
            src="assets/stretches/sun-salutation-flow.png"
            alt="Mark demonstrating a flowing yoga sequence"
          />
        </section>

        <section className="yoga-choice-grid" aria-label="Choose a yoga practice">
          <button className="card yoga-choice-card yoga-choice-card-primary" onClick={() => setMode("classes")}>
            <span className="yoga-choice-icon"><ListChecks size={24} /></span>
            <span className="eyebrow">Guided by Mark</span>
            <h2>Follow a class</h2>
            <p>Use a predefined stretching routine with the poses, timing and transitions already set up.</p>
            <span className="button primary"><Play size={16} /> Browse classes <ArrowRight size={16} /></span>
          </button>

          <button
            className="card yoga-choice-card yoga-choice-card-secondary"
            onClick={() => navigate({ name: "yoga-builder" })}
          >
            <span className="yoga-choice-icon"><Sparkles size={24} /></span>
            <span className="eyebrow">Make it yours</span>
            <h2>Invent your own</h2>
            <p>Pick from the complete pose library. Tap them in the order you want, then start your own class.</p>
            <span className="button secondary"><Sparkles size={16} /> Pick my poses <ArrowRight size={16} /></span>
          </button>
        </section>

        {data.customYogaClasses.length > 0 ? (
          <section aria-labelledby="saved-yoga-title" className="saved-yoga-section">
            <div className="section-heading yoga-section-heading">
              <div>
                <span className="eyebrow">Keep going</span>
                <h2 id="saved-yoga-title">Your saved flows</h2>
              </div>
              <span>{data.customYogaClasses.length} saved</span>
            </div>
            <div className="saved-yoga-list">
              {data.customYogaClasses.map((yogaClass) => (
                <div className="card saved-yoga-row" key={yogaClass.id}>
                  <div>
                    <strong>{yogaClass.name}</strong>
                    <span>{yogaClass.steps.length} poses · {formatDuration(yogaClass.steps.reduce((total, step) => total + (step.seconds ?? 0), 0))}</span>
                  </div>
                  <button className="button secondary" onClick={() => navigate({ name: "yoga-class", classId: yogaClass.id })}>
                    <Play size={16} /> Start
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="screen-stack yoga-screen yoga-classes-screen">
      <button className="back-link" onClick={() => setMode("choose")}>
        <ArrowLeft size={16} /> Choose how to move
      </button>

      <section className="page-intro">
        <span className="eyebrow">Predefined stretching routines</span>
        <h1>Follow a class with Mark</h1>
        <p>Choose a routine for the moment you are in. Mark will guide each pose and transition.</p>
      </section>

      {data.customYogaClasses.length > 0 ? (
        <section aria-labelledby="custom-classes-title">
          <div className="section-heading yoga-section-heading">
            <div>
              <span className="eyebrow">Your routines</span>
              <h2 id="custom-classes-title">Saved flows</h2>
            </div>
            <button className="button subtle" onClick={() => navigate({ name: "yoga-builder" })}>
              <Sparkles size={15} /> Make another
            </button>
          </div>
          <div className="yoga-class-grid">
            {data.customYogaClasses.map((yogaClass) => (
              <article className="card yoga-class-card" key={yogaClass.id}>
                <img src={yogaClass.image} alt={`Custom routine ${yogaClass.name}`} />
                <div className="yoga-class-copy">
                  <div className="yoga-class-meta">
                    <span>Made by you</span>
                    <strong><Clock3 size={14} /> {formatDuration(yogaClass.steps.reduce((total, step) => total + (step.seconds ?? 0), 0))}</strong>
                  </div>
                  <h3>{yogaClass.name}</h3>
                  <p>{yogaClass.description}</p>
                  <button className="button secondary full" onClick={() => navigate({ name: "yoga-class", classId: yogaClass.id })}>
                    <Play size={16} /> Start your flow
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="yoga-classes-title">
        <div className="section-heading yoga-section-heading">
          <div>
            <span className="eyebrow">Pick your context</span>
            <h2 id="yoga-classes-title">Classes that flow</h2>
          </div>
          <span>{YOGA_CLASSES.length} classes</span>
        </div>

        <div className="yoga-class-grid">
          {YOGA_CLASSES.map((yogaClass) => (
            <article className="card yoga-class-card" key={yogaClass.id}>
              <img src={yogaClass.image} alt={`Mark teaching ${yogaClass.name}`} />
              <div className="yoga-class-copy">
                <div className="yoga-class-meta">
                  <span>{yogaClass.timing}</span>
                  <strong><Clock3 size={14} /> {formatDuration(getYogaClassDuration(yogaClass))}</strong>
                </div>
                <h3>{yogaClass.name}</h3>
                <p>{yogaClass.description}</p>
                <div className="routine-focus" aria-label={`Focus areas for ${yogaClass.name}`}>
                  {yogaClass.focusMuscles.map((muscle) => <span key={muscle}>{muscle}</span>)}
                </div>
                <details className="routine-evidence">
                  <summary>Why this class?</summary>
                  <p>{yogaClass.evidence}</p>
                  <a href={yogaClass.sourceUrl} target="_blank" rel="noreferrer">
                    Read the guidance <ExternalLink size={13} />
                  </a>
                </details>
                <button className="button secondary full" onClick={() => navigate({ name: "yoga-class", classId: yogaClass.id })}>
                  <Play size={16} /> Join Mark&apos;s class
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
