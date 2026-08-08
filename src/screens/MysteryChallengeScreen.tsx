import { ArrowRight, Check, ChevronDown, ChevronUp, Flame, LockKeyhole, Sparkles } from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import { MEDITATIONS } from "../data";
import MeditationIcon from "../components/MeditationIcon";
import {
  challengeMeditationForCategory,
  mysteryMeditationsComplete,
  startMysteryRun
} from "../mysteryChallenge";
import type { AppData, MysteryMeditationCategory, Route } from "../types";

interface Props {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  navigate: Dispatch<SetStateAction<Route>>;
}

const categories: Array<{
  category: MysteryMeditationCategory;
  title: string;
  copy: string;
  tone: string;
}> = [
  {
    category: "Emotional",
    title: "The feeling door",
    copy: "Choose a practice that meets the emotional weather of today.",
    tone: "emotional"
  },
  {
    category: "Sensory",
    title: "The listening door",
    copy: "Choose a practice that gives your senses something kind to hold.",
    tone: "sensory"
  }
];

function categoryMeditations(category: MysteryMeditationCategory) {
  return MEDITATIONS.filter((meditation) => meditation.category === category);
}

export default function MysteryChallengeScreen({ data, setData, navigate }: Props) {
  const challenge = data.mysteryChallenge;
  const run = challenge.currentRun;
  const [openCategory, setOpenCategory] = useState<MysteryMeditationCategory | null>(null);

  const begin = () => {
    setData((current) => ({
      ...current,
      mysteryChallenge: startMysteryRun(current.mysteryChallenge)
    }));
  };

  const chooseMeditation = (category: MysteryMeditationCategory, meditationId: string) => {
    if (!run || challengeMeditationForCategory(challenge, category)) return;
    setOpenCategory(null);
    navigate({ name: "timer", meditationId, mysteryCategory: category, mysteryRunId: run.id });
  };

  const canJournal = mysteryMeditationsComplete(challenge) && Boolean(run);
  const showInvitationStart = !run && !challenge.bonusUnlocked;
  const completionMessage = challenge.completedRuns > 0
    ? challenge.lastRunMatchedSecret
      ? "The seal opened. Something was waiting inside."
      : "The invitation accepted your reflection. One detail remains elusive."
    : "Two meditations. One reflection. The rest is deliberately unlabelled.";

  return (
    <div className="screen-stack mystery-challenge-screen">
      <section className="page-intro mystery-intro">
        <div>
          <span className="eyebrow">A sealed invitation</span>
          <h1>The quiet sequence</h1>
          <p>{challenge.bonusUnlocked ? "The hidden ember has been found." : completionMessage}</p>
        </div>
        <span className="mystery-intro-mark"><LockKeyhole /></span>
      </section>

      {challenge.clueVisible && !challenge.bonusUnlocked ? (
        <section className="card mystery-clue" aria-live="polite">
          <Sparkles />
          <div>
            <span className="eyebrow">A fragment of the seal</span>
            <p>It remembers the order of your footsteps, even when the doors look the same.</p>
          </div>
        </section>
      ) : null}

      {challenge.bonusUnlocked ? (
        <section className="card mystery-reveal">
          <div className="mystery-reveal-art-wrap">
            <img src="assets/badges/unseen-flame.jpg" alt="The Unseen Flame badge artwork" />
          </div>
          <div>
            <span className="eyebrow">Secret badge revealed</span>
            <h2>The Unseen Flame</h2>
            <p>You noticed the pattern beneath the pattern.</p>
          </div>
        </section>
      ) : showInvitationStart ? (
        <section className="card mystery-start-card">
          <span className="mystery-seal"><Flame /></span>
          <div>
            <h2>Something has been left here.</h2>
            <p>Begin when you want. The invitation can be paused and resumed without losing its place.</p>
            <button className="button primary" onClick={begin}>
              {challenge.completedRuns ? "Try the sequence again" : "Open the invitation"} <ArrowRight size={17} />
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="card mystery-progress-card">
            <div className="section-row">
              <div>
                <span className="eyebrow">Current invitation</span>
                <h2>Choose your two doors</h2>
              </div>
              <span className="mystery-count">
                {(run?.meditations.length ?? 0)} / 2 <small>meditations</small>
              </span>
            </div>
            <p>Complete both meditations in whichever order feels right. The final door is your journal.</p>
          </section>

          <section className="mystery-door-list" aria-label="Mystery meditation choices">
            {categories.map(({ category, title, copy, tone }) => {
              const completed = challengeMeditationForCategory(challenge, category);
              const isOpen = openCategory === category;
              return (
                <article className={`card mystery-door ${tone} ${completed ? "complete" : ""}`} key={category}>
                  <button
                    className="mystery-door-trigger"
                    onClick={() => setOpenCategory(isOpen ? null : category)}
                    aria-expanded={isOpen}
                  >
                    <span className="mystery-door-icon">
                      {completed ? <Check /> : <MeditationIcon meditationId={category === "Emotional" ? "metta" : "binaural"} />}
                    </span>
                    <span>
                      <strong>{completed ? MEDITATIONS.find((item) => item.id === completed.meditationId)?.name ?? completed.meditationId : title}</strong>
                      <small>{completed ? "Practice completed. The door remembers." : copy}</small>
                    </span>
                    {completed ? <Check className="mystery-door-check" /> : isOpen ? <ChevronUp /> : <ChevronDown />}
                  </button>

                  {isOpen && !completed ? (
                    <div className="mystery-choice-list">
                      {categoryMeditations(category).map((meditation) => (
                        <button
                          className="mystery-choice"
                          key={meditation.id}
                          onClick={() => chooseMeditation(category, meditation.id)}
                        >
                          <MeditationIcon meditationId={meditation.id} />
                          <span>
                            <strong>{meditation.name}</strong>
                            <small>{meditation.benefit}</small>
                          </span>
                          <ArrowRight size={16} />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>

          <section className={`card mystery-journal-card ${canJournal ? "ready" : ""}`}>
            <span className="mystery-journal-number">3</span>
            <div>
              <span className="eyebrow">Final door</span>
              <h2>Write what changed</h2>
              <p>{canJournal ? "The page is open. Give the after-effect a few honest lines." : "Complete both meditations to reveal the journal invitation."}</p>
              <button
                className="button primary"
                disabled={!canJournal}
                onClick={() => run && navigate({ name: "journal", draftMeditation: "The quiet sequence", mysteryRunId: run.id })}
              >
                Open the journal <ArrowRight size={17} />
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
