import { useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  ListChecks,
  Play,
  Sparkles
} from "lucide-react";
import { getYogaClassDuration, YOGA_CLASSES } from "../data";
import type { AppData, Route, YogaClass } from "../types";

interface Props {
  data: AppData;
  navigate: Dispatch<SetStateAction<Route>>;
  initialMode?: YogaMode;
}

type YogaMode = "choose" | "classes";

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const classDuration = (yogaClass: YogaClass) =>
  yogaClass.id.startsWith("custom-")
    ? yogaClass.steps.reduce((total, step) => total + (step.seconds ?? 0), 0)
    : getYogaClassDuration(yogaClass);

interface ClassCardProps {
  yogaClass: YogaClass;
  custom?: boolean;
  onOpen: () => void;
}

function YogaClassCard({ yogaClass, custom = false, onOpen }: ClassCardProps) {
  return (
    <article className="card yoga-class-card">
      <div className="yoga-class-art">
        <img src={yogaClass.image} alt={`Mark teaching ${yogaClass.name}`} />
        <span>{custom ? "Made by you" : "With Mark"}</span>
      </div>
      <div className="yoga-class-copy">
        <div className="yoga-class-meta">
          <span>{yogaClass.timing}</span>
          <strong><Clock3 size={14} /> {formatDuration(classDuration(yogaClass))}</strong>
        </div>
        <h3>{yogaClass.name}</h3>
        <p>{yogaClass.description}</p>
        <button className="button secondary full" onClick={onOpen}>
          <Play size={16} /> View class <ArrowRight size={16} />
        </button>
      </div>
    </article>
  );
}

export default function YogaScreen({ data, navigate, initialMode = "choose" }: Props) {
  const [mode, setMode] = useState<YogaMode>(initialMode);

  if (mode === "choose") {
    return (
      <div className="screen-stack yoga-screen yoga-choice-screen">
        <section className="yoga-landing-hero">
          <div className="yoga-landing-copy">
            <span className="eyebrow">Yoga with Mark</span>
            <h1>How do you want to move?</h1>
            <p>
              Follow a class built for a moment in your day, or choose every pose yourself
              and make a flow that feels right today.
            </p>
          </div>

          <img
            className="yoga-mark-hero"
            src="assets/yoga/mark-hero-v2.png"
            alt="Mark sitting calmly, ready to guide a yoga class"
          />

          <div className="yoga-landing-actions" aria-label="Choose a yoga practice">
            <button onClick={() => setMode("classes")}>
              <span className="yoga-action-icon"><ListChecks size={23} /></span>
              <span><strong>Browse classes</strong><small>Choose a guided flow</small></span>
              <ArrowRight size={18} />
            </button>
            <button onClick={() => navigate({ name: "yoga-builder" })}>
              <span className="yoga-action-icon"><Sparkles size={23} /></span>
              <span><strong>Build my own flow</strong><small>Pick every pose</small></span>
              <ArrowRight size={18} />
            </button>
          </div>
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
                    <span>{yogaClass.steps.length} poses · {formatDuration(classDuration(yogaClass))}</span>
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
        <ArrowLeft size={16} /> Yoga home
      </button>

      <section className="page-intro yoga-browser-intro">
        <span className="eyebrow">Guided by Mark</span>
        <h1>Find your flow</h1>
        <p>Choose the kind of movement your body needs today.</p>
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
              <YogaClassCard
                key={yogaClass.id}
                yogaClass={yogaClass}
                custom
                onOpen={() => navigate({ name: "yoga-class", classId: yogaClass.id })}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="yoga-classes-title">
        <div className="section-heading yoga-section-heading">
          <div>
            <span className="eyebrow">Guided classes</span>
            <h2 id="yoga-classes-title">Move with intention</h2>
          </div>
          <span>{YOGA_CLASSES.length} classes</span>
        </div>

        <div className="yoga-class-grid">
          {YOGA_CLASSES.map((yogaClass) => (
            <YogaClassCard
              key={yogaClass.id}
              yogaClass={yogaClass}
              onOpen={() => navigate({ name: "yoga-class", classId: yogaClass.id })}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
