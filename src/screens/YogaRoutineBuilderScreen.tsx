import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  Clock3,
  Play,
  Save,
  Trash2
} from "lucide-react";
import type { AppData, Movement, Route, YogaClass, YogaClassStep } from "../types";
import { MOVEMENTS } from "../data";
import MovementVisual from "../components/MovementVisual";

interface Props {
  editClassId?: string;
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  navigate: Dispatch<SetStateAction<Route>>;
}

const defaultSeconds = 30;

export default function YogaRoutineBuilderScreen({ editClassId, data, setData, navigate }: Props) {
  const existingClass = editClassId
    ? data.customYogaClasses.find((yogaClass) => yogaClass.id === editClassId)
    : undefined;
  const [name, setName] = useState(existingClass?.name ?? "");
  const [steps, setSteps] = useState<YogaClassStep[]>(existingClass?.steps ?? []);
  const [focusedMovementId, setFocusedMovementId] = useState(existingClass?.steps[0]?.movementId ?? MOVEMENTS[0].id);

  const focusedMovement = useMemo(
    () => MOVEMENTS.find((movement) => movement.id === focusedMovementId) ?? MOVEMENTS[0],
    [focusedMovementId]
  );

  const selectionNumbers = useMemo(() => {
    const numbers = new Map<string, number[]>();
    steps.forEach((step, index) => {
      const current = numbers.get(step.movementId) ?? [];
      numbers.set(step.movementId, [...current, index + 1]);
    });
    return numbers;
  }, [steps]);

  const totalSeconds = steps.reduce((total, step) => total + (step.seconds ?? defaultSeconds), 0);

  const makeRoutine = (): YogaClass => ({
    id: existingClass?.id ?? `custom-${crypto.randomUUID()}`,
    name: name.trim() || existingClass?.name || "My Yoga Flow",
    timing: "Custom flow",
    description: "A custom sequence created by you.",
    evidence: "You chose this sequence yourself. Keep every pose comfortable and stop if anything feels sharp or painful.",
    sourceUrl: "",
    focusMuscles: Array.from(new Set(steps.flatMap((step) => MOVEMENTS.find((movement) => movement.id === step.movementId)?.muscleGroups ?? []))).slice(0, 5),
    image: "assets/stretches/sun-salutation-flow.png",
    steps
  });

  const commitRoutine = (startNow: boolean) => {
    if (steps.length === 0) return;
    const routine = makeRoutine();
    setData((currentData) => {
      const customYogaClasses = currentData.customYogaClasses ?? [];
      const alreadyExists = customYogaClasses.some((yogaClass) => yogaClass.id === routine.id);
      return {
        ...currentData,
        customYogaClasses: alreadyExists
          ? customYogaClasses.map((yogaClass) => yogaClass.id === routine.id ? routine : yogaClass)
          : [...customYogaClasses, routine]
      };
    });
    navigate(startNow ? { name: "yoga-class", classId: routine.id } : { name: "yoga" });
  };

  const addStep = (movement: Movement) => {
    setFocusedMovementId(movement.id);
    setSteps((currentSteps) => [...currentSteps, { movementId: movement.id, seconds: movement.seconds > 0 ? Math.min(30, movement.seconds) : defaultSeconds }]);
  };

  const removeStep = (index: number) => setSteps((currentSteps) => currentSteps.filter((_, stepIndex) => stepIndex !== index));

  const moveStep = (index: number, direction: -1 | 1) => {
    setSteps((currentSteps) => {
      const next = [...currentSteps];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return next;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const updateDuration = (index: number, seconds: number) => {
    setSteps((currentSteps) => currentSteps.map((step, stepIndex) => stepIndex === index ? { ...step, seconds } : step));
  };

  return (
    <div className="screen-stack yoga-builder-screen">
      <section className="page-intro yoga-builder-intro">
        <span className="eyebrow">Make your own</span>
        <h1>{existingClass ? "Edit your flow" : "Invent your own flow"}</h1>
        <p>Tap the poses below in the order you want to do them. The small numbers show the class order.</p>
      </section>

      <section className="card builder-selection-panel" aria-labelledby="selected-flow-title">
        <div className="section-row">
          <div>
            <span className="eyebrow">Your sequence</span>
            <h2 id="selected-flow-title">{steps.length ? `${steps.length} ${steps.length === 1 ? "pose" : "poses"} selected` : "Start with a pose"}</h2>
          </div>
          <span className="builder-duration"><Clock3 size={15} /> {Math.floor(totalSeconds / 60)}:{String(totalSeconds % 60).padStart(2, "0")}</span>
        </div>

        {steps.length ? (
          <div className="builder-sequence">
            {steps.map((step, index) => {
              const movement = MOVEMENTS.find((item) => item.id === step.movementId);
              if (!movement) return null;
              return (
                <div className="builder-step-row" key={`${step.movementId}-${index}`}>
                  <span className="builder-step-number">{index + 1}</span>
                  <span className="builder-step-name">{movement.name}</span>
                  <select value={step.seconds ?? defaultSeconds} onChange={(event) => updateDuration(index, Number(event.target.value))} aria-label={`Duration for ${movement.name}`}>
                    <option value="15">15s</option>
                    <option value="30">30s</option>
                    <option value="45">45s</option>
                    <option value="60">60s</option>
                  </select>
                  <button className="round-button small" onClick={() => moveStep(index, -1)} disabled={index === 0} aria-label={`Move ${movement.name} earlier`}><ArrowUp size={15} /></button>
                  <button className="round-button small" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} aria-label={`Move ${movement.name} later`}><ArrowDown size={15} /></button>
                  <button className="round-button small builder-remove" onClick={() => removeStep(index)} aria-label={`Remove ${movement.name}`}><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="builder-empty-state">Your taps will appear here. You can repeat a pose, move it later, or remove it at any time.</p>
        )}
      </section>

      <section className="pose-library-panel" aria-labelledby="pose-picker-title">
        <div className="section-heading yoga-section-heading">
          <div>
            <span className="eyebrow">The complete library</span>
            <h2 id="pose-picker-title">Pick your poses</h2>
          </div>
          <span>{MOVEMENTS.length} available</span>
        </div>

        <aside className="pose-tip-card" aria-live="polite">
          <MovementVisual movement={focusedMovement} compact />
          <div>
            <strong>{focusedMovement.name}</strong>
            <p><b>Useful for:</b> {focusedMovement.muscleGroups.join(" · ")}</p>
            <small>{focusedMovement.sensationCue}</small>
          </div>
        </aside>

        <div className="pose-picker-grid">
          {MOVEMENTS.map((movement) => {
            const order = selectionNumbers.get(movement.id) ?? [];
            const isFocused = focusedMovement.id === movement.id;
            return (
              <button
                className={`pose-picker-tile ${order.length ? "selected" : ""} ${isFocused ? "focused" : ""}`}
                key={movement.id}
                onClick={() => addStep(movement)}
                onFocus={() => setFocusedMovementId(movement.id)}
                onMouseEnter={() => setFocusedMovementId(movement.id)}
                aria-label={`Add ${movement.name}${order.length ? `, currently selected at ${order.join(", ")}` : ""}`}
                aria-pressed={order.length > 0}
              >
                <span className="pose-tile-image">
                  {movement.image ? <img src={movement.image} alt="" /> : <span className="pose-tile-image-placeholder" aria-hidden="true" />}
                </span>
                {order.length ? <span className="pose-order-badge"><Check size={11} />{order[0]}{order.length > 1 ? ` +${order.length - 1}` : ""}</span> : null}
                <span className="pose-tile-copy">
                  <strong>{movement.name}</strong>
                  <small>{movement.muscleGroups.slice(0, 2).join(" · ")}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card builder-save-panel">
        <label>
          <span>Give this flow a name <small>(optional)</small></span>
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Morning loosen-up" />
        </label>
        <div className="builder-actions">
          <button className="button primary" onClick={() => commitRoutine(true)} disabled={!steps.length}>
            <Play size={17} fill="currentColor" /> Start class
          </button>
          <button className="button subtle" onClick={() => commitRoutine(false)} disabled={!steps.length}>
            <Save size={16} /> Save for later
          </button>
        </div>
      </section>
    </div>
  );
}
