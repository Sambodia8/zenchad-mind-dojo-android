import { useMemo, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { Check, ChevronRight, Plus, Sparkles, Star, X } from "lucide-react";
import { makeEmotionalTool, startEmotionalToolAttempt } from "../storage";
import type {
  AppData,
  EmotionalMoodBand,
  EmotionalTool,
  EmotionalToolAttempt
} from "../types";

interface Props {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
}

const moodBands: Array<{
  id: EmotionalMoodBand;
  label: string;
  shortLabel: string;
  range: [number, number];
  color: string;
}> = [
  { id: "red", label: "In the red", shortLabel: "Red", range: [0, 19], color: "#ef4444" },
  { id: "orange", label: "Activated", shortLabel: "Orange", range: [20, 39], color: "#f97316" },
  { id: "yellow", label: "Wobbly", shortLabel: "Yellow", range: [40, 59], color: "#facc15" },
  { id: "lime", label: "Steadying", shortLabel: "Yellow-green", range: [60, 79], color: "#a3e635" },
  { id: "green", label: "Feeling good", shortLabel: "Green", range: [80, 100], color: "#22c55e" }
];

const bandForMood = (mood: number) =>
  moodBands.find((band) => mood >= band.range[0] && mood <= band.range[1]) ?? moodBands[2];

const formatBands = (bands: EmotionalMoodBand[]) =>
  bands
    .map((bandId) => moodBands.find((band) => band.id === bandId)?.shortLabel ?? bandId)
    .join(" / ");

const formatToolMovement = (tool: EmotionalTool) =>
  `${formatBands(tool.usefulFor)} → ${
    tool.expectedOutcome.length ? formatBands(tool.expectedOutcome) : "outcome not set"
  }${tool.outcomeUncertain ? "?" : ""}`;

const moodBandIndexes = new Map(
  moodBands.map((band, index) => [band.id, index] as const)
);

const analyseTool = (
  tool: EmotionalTool,
  mood: number,
  attempts: EmotionalToolAttempt[]
) => {
  const currentBand = bandForMood(mood).id;
  const currentIndex = moodBandIndexes.get(currentBand) ?? 2;
  const distance = Math.min(
    ...tool.usefulFor.map((band) =>
      Math.abs((moodBandIndexes.get(band) ?? currentIndex) - currentIndex)
    )
  );
  const base = distance === 0 ? 120 : distance === 1 ? 52 : Math.max(4, 20 - distance * 7);
  const nearbyResults = attempts.filter(
    (attempt) =>
      attempt.toolId === tool.id &&
      attempt.afterMood !== undefined &&
      Math.abs(attempt.beforeMood - mood) <= 22
  );
  const averageLift = nearbyResults.length
    ? nearbyResults.reduce(
        (sum, attempt) => sum + ((attempt.afterMood ?? attempt.beforeMood) - attempt.beforeMood),
        0
      ) / nearbyResults.length
    : 0;

  return {
    tool,
    distance,
    averageLift,
    samples: nearbyResults.length,
    score: base + averageLift * 3 + Math.min(nearbyResults.length, 5) * 2
  };
};

type AnalysedTool = ReturnType<typeof analyseTool>;

const suggestionReason = (suggestion: AnalysedTool, mood: number) => {
  if (suggestion.samples) {
    const direction = suggestion.averageLift > 0 ? "+" : "";
    return `${direction}${Math.round(suggestion.averageLift)} average from ${suggestion.samples} check-in${
      suggestion.samples === 1 ? "" : "s"
    }`;
  }
  if (suggestion.distance === 0) return `Exact fit for ${bandForMood(mood).shortLabel}`;
  return `Nearby option from ${formatBands(suggestion.tool.usefulFor)}`;
};

type Panel = "mood" | "suggestions" | "selected" | "add" | "feedback" | "saved";

export default function EmotionalToolbox({ data, setData }: Props) {
  const pendingAttempt = data.emotionalToolAttempts.find((attempt) => !attempt.completedAt);
  const [panel, setPanel] = useState<Panel>(pendingAttempt ? "feedback" : "mood");
  const [mood, setMood] = useState(50);
  const [afterMood, setAfterMood] = useState(pendingAttempt?.beforeMood ?? 50);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(
    pendingAttempt?.toolId ?? null
  );
  const [feedback, setFeedback] = useState("");
  const [newName, setNewName] = useState("");
  const [newDetails, setNewDetails] = useState("");
  const [newBands, setNewBands] = useState<EmotionalMoodBand[]>(["yellow"]);
  const [newOutcomeBands, setNewOutcomeBands] = useState<EmotionalMoodBand[]>([]);
  const currentBand = bandForMood(mood);
  const chestIsOpen = panel === "suggestions" || panel === "selected" || panel === "saved";

  const suggestions = useMemo(
    () =>
      data.emotionalTools
        .map((tool) => analyseTool(tool, mood, data.emotionalToolAttempts))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3),
    [data.emotionalToolAttempts, data.emotionalTools, mood]
  );

  const selectedTool =
    data.emotionalTools.find((tool) => tool.id === selectedToolId) ??
    suggestions[0]?.tool ??
    data.emotionalTools[0];
  const completedAttempts = data.emotionalToolAttempts.filter(
    (attempt) => attempt.completedAt && attempt.didComplete !== false
  );

  const chooseSuggestion = (tool: EmotionalTool) => {
    setSelectedToolId(tool.id);
    setPanel("selected");
  };

  const startTool = () => {
    if (!selectedTool || pendingAttempt) return;
    const attempt = startEmotionalToolAttempt(selectedTool.id, mood);
    setData((current) => ({
      ...current,
      emotionalToolAttempts: [attempt, ...current.emotionalToolAttempts]
    }));
    setPanel("saved");
  };

  const saveFeedback = () => {
    if (!pendingAttempt) return;
    const completedAt = new Date().toISOString();
    setData((current) => ({
      ...current,
      emotionalToolAttempts: current.emotionalToolAttempts.map((attempt) =>
        attempt.id === pendingAttempt.id
          ? { ...attempt, completedAt, didComplete: true, afterMood, notes: feedback.trim() }
          : attempt
      )
    }));
    setMood(afterMood);
    setFeedback("");
    setPanel("mood");
  };

  const skipFeedback = () => {
    if (!pendingAttempt) return;
    const completedAt = new Date().toISOString();
    setData((current) => ({
      ...current,
      emotionalToolAttempts: current.emotionalToolAttempts.map((attempt) =>
        attempt.id === pendingAttempt.id
          ? { ...attempt, completedAt, didComplete: false, notes: "Not completed" }
          : attempt
      )
    }));
    setMood(pendingAttempt.beforeMood);
    setPanel("mood");
  };

  const toggleBand = (band: EmotionalMoodBand) => {
    setNewBands((current) =>
      current.includes(band)
        ? current.length === 1
          ? current
          : current.filter((item) => item !== band)
        : [...current, band]
    );
  };

  const toggleOutcomeBand = (band: EmotionalMoodBand) => {
    setNewOutcomeBands((current) =>
      current.includes(band)
        ? current.filter((item) => item !== band)
        : [...current, band]
    );
  };

  const addTool = () => {
    if (!newName.trim() || !newDetails.trim()) return;
    const tool = makeEmotionalTool(
      newName.trim(),
      newDetails.trim(),
      newBands,
      newOutcomeBands
    );
    setData((current) => ({
      ...current,
      emotionalTools: [...current.emotionalTools, tool]
    }));
    setNewName("");
    setNewDetails("");
    setNewBands(["yellow"]);
    setNewOutcomeBands([]);
    setSelectedToolId(tool.id);
    setPanel("mood");
  };

  return (
    <div className={`emotional-toolbox ${chestIsOpen ? "is-open" : ""}`}>
      <div className="toolbox-stage">
        <div className="toolbox-stars" aria-hidden="true">
          <Sparkles />
          <Star />
          <Sparkles />
          <Star />
          <Sparkles />
        </div>

        {panel === "suggestions" && (
          <div className="floating-suggestions" aria-live="polite">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.tool.id}
                className={`floating-tool floating-tool-${index + 1} ${
                  suggestion.distance === 0 ? "exact-match" : "nearby-match"
                }`}
                onClick={() => chooseSuggestion(suggestion.tool)}
              >
                <span className="floating-tool-copy">
                  <strong>{suggestion.tool.name}</strong>
                  <small>{suggestionReason(suggestion, mood)}</small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        )}

        <div className="treasure-chest" aria-hidden="true">
          <div className="chest-glow" />
          <div className="chest-rays">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="chest-lid">
            <div className="lid-face">
              <i className="lid-highlight" />
            </div>
            <i className="gold-arch gold-arch-left" />
            <i className="gold-arch gold-arch-right" />
          </div>
          <div className="chest-interior" />
          <div className="chest-hinges">
            <span />
            <span />
          </div>
          <div className="chest-magic">
            <span />
            <span />
            <span />
          </div>
          <div className="chest-base">
            <i className="gold-rail gold-rail-top" />
            <i className="gold-rail gold-rail-bottom" />
            <i className="gold-post gold-post-left" />
            <i className="gold-post gold-post-right" />
            <span className="chest-lock"><i /></span>
            <span className="chest-stud chest-stud-left" />
            <span className="chest-stud chest-stud-right" />
          </div>
        </div>

        {panel === "mood" && (
          <section className="toolbox-popover mood-popover">
            <span className="eyebrow">Before we open it</span>
            <h2>How are you feeling?</h2>
            <p>Drag to the colour that feels closest. There is no wrong answer.</p>
            <div className="mood-readout">
              <span style={{ background: currentBand.color }} />
              <strong>{currentBand.label}</strong>
              <b>{mood}</b>
            </div>
            <input
              className="toolbox-mood-slider"
              type="range"
              min="0"
              max="100"
              value={mood}
              onChange={(event) => setMood(Number(event.target.value))}
              aria-label="How are you feeling, from red to green"
            />
            <div className="toolbox-gradient-labels">
              <span>Overwhelmed</span>
              <span>Feeling good</span>
            </div>
            <button className="button treasure-button full" onClick={() => setPanel("suggestions")}>
              <Sparkles size={18} /> Open my toolbox
            </button>
          </section>
        )}

        {panel === "selected" && selectedTool && (
          <section className="toolbox-popover selection-popover">
            <button className="popover-close" onClick={() => setPanel("suggestions")} aria-label="Close">
              <X size={18} />
            </button>
            <span className="eyebrow">The toolbox picked</span>
            <h2>{selectedTool.name}</h2>
            <p>{selectedTool.details}</p>
            <div className="tool-colour-map">
              <div>
                <small>Works from</small>
                <div className="mood-band-row compact">
                  {selectedTool.usefulFor.map((bandId) => {
                    const band = moodBands.find((item) => item.id === bandId)!;
                    return <span key={band.id} style={{ "--band": band.color } as CSSProperties}>{band.shortLabel}</span>;
                  })}
                </div>
              </div>
              <span className="colour-map-arrow">→</span>
              <div>
                <small>{selectedTool.outcomeUncertain ? "Might move toward" : "Expected toward"}</small>
                {selectedTool.expectedOutcome.length ? (
                  <div className="mood-band-row compact">
                    {selectedTool.expectedOutcome.map((bandId) => {
                      const band = moodBands.find((item) => item.id === bandId)!;
                      return <span key={band.id} style={{ "--band": band.color } as CSSProperties}>{band.shortLabel}</span>;
                    })}
                  </div>
                ) : (
                  <span className="outcome-unset">Not set yet</span>
                )}
              </div>
            </div>
            <button className="button treasure-button full" onClick={startTool}>
              <Check size={18} /> I’ll try this
            </button>
          </section>
        )}

        {panel === "feedback" && pendingAttempt && selectedTool && (
          <section className="toolbox-popover feedback-popover">
            <span className="eyebrow">Welcome back</span>
            <h2>How did it go?</h2>
            <p>You tried <strong>{selectedTool.name}</strong> from a mood of {pendingAttempt.beforeMood}.</p>
            <label>
              How do you feel now?
              <strong className="feedback-mood-name">{bandForMood(afterMood).label} · {afterMood}</strong>
              <input
                className="toolbox-mood-slider"
                type="range"
                min="0"
                max="100"
                value={afterMood}
                onChange={(event) => setAfterMood(Number(event.target.value))}
              />
            </label>
            <textarea
              rows={3}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="What helped, or what got in the way? (optional)"
            />
            <div className={`mood-change-preview ${
              afterMood > pendingAttempt.beforeMood
                ? "improved"
                : afterMood < pendingAttempt.beforeMood
                  ? "lower"
                  : "same"
            }`}>
              <span>{pendingAttempt.beforeMood}</span>
              <ChevronRight size={16} />
              <strong>{afterMood}</strong>
              <small>
                {afterMood > pendingAttempt.beforeMood
                  ? `Up ${afterMood - pendingAttempt.beforeMood}`
                  : afterMood < pendingAttempt.beforeMood
                    ? `Down ${pendingAttempt.beforeMood - afterMood}`
                    : "No change"}
              </small>
            </div>
            <div className="feedback-actions">
              <button className="button treasure-button" onClick={saveFeedback}>
                Save what I learned
              </button>
              <button className="button ghost" onClick={skipFeedback}>
                I didn’t do it
              </button>
            </div>
          </section>
        )}

        {panel === "add" && (
          <section className="toolbox-popover add-tool-popover">
            <button className="popover-close" onClick={() => setPanel("mood")} aria-label="Close">
              <X size={18} />
            </button>
            <span className="eyebrow">Add to the chest</span>
            <h2>New emotional tool</h2>
            <label>
              What is it called?
              <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Call Jamie" />
            </label>
            <label>
              What do you do, and what is it useful for?
              <textarea rows={3} value={newDetails} onChange={(event) => setNewDetails(event.target.value)} placeholder="The detail future-you will need…" />
            </label>
            <fieldset>
              <legend>It may help when I’m…</legend>
              <div className="mood-band-row">
                {moodBands.map((band) => (
                  <button
                    type="button"
                    key={band.id}
                    className={newBands.includes(band.id) ? "active" : ""}
                    style={{ "--band": band.color } as CSSProperties}
                    onClick={() => toggleBand(band.id)}
                  >
                    {band.shortLabel}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>I hope it leaves me feeling… (optional)</legend>
              <div className="mood-band-row">
                {moodBands.map((band) => (
                  <button
                    type="button"
                    key={band.id}
                    className={newOutcomeBands.includes(band.id) ? "active" : ""}
                    style={{ "--band": band.color } as CSSProperties}
                    onClick={() => toggleOutcomeBand(band.id)}
                  >
                    {band.shortLabel}
                  </button>
                ))}
              </div>
            </fieldset>
            <button
              className="button treasure-button full"
              disabled={!newName.trim() || !newDetails.trim()}
              onClick={addTool}
            >
              <Plus size={18} /> Add to my toolbox
            </button>
          </section>
        )}

        {panel === "saved" && selectedTool && (
          <section className="toolbox-popover saved-popover">
            <span className="saved-tick"><Check /></span>
            <span className="eyebrow">Packed for later</span>
            <h2>{selectedTool.name}</h2>
            <p>Go try it. The toolbox will ask how it went when you come back.</p>
          </section>
        )}
      </div>

      <div className="toolbox-actions">
        <button className="button secondary" onClick={() => setPanel("add")}>
          <Plus size={17} /> Add your own
        </button>
        <button
          className="button ghost"
          disabled={Boolean(pendingAttempt)}
          onClick={() => setPanel("mood")}
        >
          {pendingAttempt ? <Check size={17} /> : <Sparkles size={17} />}
          {pendingAttempt ? "Check-in waiting" : "Pick again"}
        </button>
      </div>

      <section className="card toolbox-inventory">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Inside your toolbox</span>
            <h3>{data.emotionalTools.length} things that might help</h3>
          </div>
          <span className="learning-count">
            {completedAttempts.length} check-in{completedAttempts.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="inventory-list">
          {data.emotionalTools.map((tool) => {
            const uses = completedAttempts.filter((attempt) => attempt.toolId === tool.id);
            return (
              <button key={tool.id} onClick={() => chooseSuggestion(tool)}>
                <span className="inventory-spark"><Star size={15} /></span>
                <span>
                  <strong>{tool.name}</strong>
                  <small>
                    <b>{formatToolMovement(tool)}</b>
                    {" · "}
                    {uses.length ? `${uses.length} check-in${uses.length === 1 ? "" : "s"}` : "Not tried yet"}
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
