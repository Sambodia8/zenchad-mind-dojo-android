import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction
} from "react";
import {
  Bike,
  Check,
  Clock3,
  Footprints,
  Glasses,
  Play,
  RotateCcw,
  ShowerHead,
  Sparkles,
  Trophy
} from "lucide-react";
import { LEVEL_THRESHOLDS } from "../data";
import {
  BIKE_TIMED_STEPS,
  clearBikeQuestState,
  createBikeQuestState,
  immediateBonusXp,
  loadBikeQuestState,
  projectedRideXp,
  saveBikeQuestState,
  timedStepXp,
  type BikeQuestResume,
  type BikeQuestState,
  type BikeVrChoice
} from "../bikeQuest";
import {
  cancelBikeRideNotification,
  showBikeRideRunningNotification
} from "../native";
import { addCompletedSession } from "../storage";
import type { AppData, Route, Stats } from "../types";
import { playUiSfx } from "../uiSfx";

interface Props {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  navigate: Dispatch<SetStateAction<Route>>;
  resume?: BikeQuestResume;
}

interface Celebration {
  id: number;
  label: string;
  xp: number;
  word: string;
}

const CELEBRATION_WORDS = ["NICE", "SICK", "RADICAL", "LAD", "LEGEND"];
const PRE_STRETCH_BONUS_DRAIN_SECONDS = 4 * 60;
const ARM_SET_XP = 25;

const formatClock = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const levelForXp = (xp: number) => {
  const nextThreshold = LEVEL_THRESHOLDS.findIndex((threshold) => xp < threshold);
  return nextThreshold === -1 ? LEVEL_THRESHOLDS.length : Math.max(1, nextThreshold);
};

const addFlatXp = (stats: Stats, amount: number): Stats => {
  const xp = stats.xp + Math.max(0, amount);
  return { ...stats, xp, level: levelForXp(xp) };
};

function RewardBurst({ celebration }: { celebration: Celebration }) {
  return (
    <div className="bike-reward-burst" role="status" aria-live="polite">
      <div className="bike-fireworks" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <span key={index} style={{ "--spark": index } as CSSProperties} />
        ))}
      </div>
      <strong>{celebration.word}</strong>
      <span>{celebration.label}</span>
      <b>+{celebration.xp} XP</b>
    </div>
  );
}

export default function BikeQuestScreen({ data, setData, navigate, resume }: Props) {
  const [quest, setQuest] = useState<BikeQuestState | null>(() => loadBikeQuestState());
  const [now, setNow] = useState(Date.now());
  const [coinFlipping, setCoinFlipping] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const celebrationTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!quest || quest.step === "complete") return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [quest?.step]);

  useEffect(
    () => () => {
      if (celebrationTimer.current) window.clearTimeout(celebrationTimer.current);
    },
    []
  );

  const celebrate = useCallback(
    (label: string, xp: number, stronger = false) => {
      if (celebrationTimer.current) window.clearTimeout(celebrationTimer.current);
      const word = CELEBRATION_WORDS[Math.floor(Math.random() * CELEBRATION_WORDS.length)];
      setCelebration({ id: Date.now(), label, xp, word });
      navigator.vibrate?.(stronger ? [35, 35, 75, 45, 120, 55, 75] : [28, 32, 65, 35, 90]);
      if (data.preferences.uiSoundsEnabled) {
        playUiSfx(stronger ? "victory" : "xpGain");
        if (stronger) window.setTimeout(() => playUiSfx("xpGain"), 380);
      }
      celebrationTimer.current = window.setTimeout(() => setCelebration(null), 1350);
    },
    [data.preferences.uiSoundsEnabled]
  );

  const persistQuest = useCallback((next: BikeQuestState) => {
    saveBikeQuestState(next);
    setQuest(next);
    setNow(Date.now());
  }, []);

  const updateQuest = useCallback(
    (mutate: (current: BikeQuestState) => BikeQuestState) => {
      const current = loadBikeQuestState();
      if (!current) return null;
      const next = mutate(current);
      persistQuest(next);
      return next;
    },
    [persistQuest]
  );

  const awardXp = useCallback(
    (
      key: string,
      amount: number,
      label: string,
      mutate: (current: BikeQuestState) => BikeQuestState,
      stronger = false
    ) => {
      const current = loadBikeQuestState();
      if (!current || current.awards[key] !== undefined) return current;
      const awarded: BikeQuestState = {
        ...current,
        awards: { ...current.awards, [key]: amount },
        totalQuestXp: current.totalQuestXp + amount
      };
      const next = mutate(awarded);
      persistQuest(next);
      setData((currentData) => ({
        ...currentData,
        stats: addFlatXp(currentData.stats, amount)
      }));
      celebrate(label, amount, stronger);
      return next;
    },
    [celebrate, persistQuest, setData]
  );

  useEffect(() => {
    if (!quest || !resume) return;
    if (resume === "pre-stretch-complete" && !quest.preStretchCompleted) {
      awardXp(
        "pre-stretch-finish",
        15,
        "Pre-bike stretches complete",
        (current) => ({
          ...current,
          preStretchCompleted: true,
          step: "water",
          stepStartedAt: Date.now()
        }),
        true
      );
    }
    if (resume === "post-stretch-complete" && !quest.postStretchCompleted) {
      awardXp(
        "post-stretch-finish",
        15,
        "Warm-down complete",
        (current) => ({
          ...current,
          postStretchCompleted: true,
          postStretchSkipped: false,
          step: "recovery",
          stepStartedAt: Date.now()
        }),
        true
      );
    }
  }, [awardXp, quest, resume]);

  const startQuest = () => {
    const next = createBikeQuestState();
    persistQuest(next);
  };

  const resetQuest = () => {
    void cancelBikeRideNotification();
    clearBikeQuestState();
    setQuest(null);
    setCelebration(null);
  };

  const chooseVr = useCallback(
    (choice: BikeVrChoice, source: "manual" | "coin") => {
      awardXp(
        "vr-choice",
        10,
        source === "coin" ? `Coin says ${choice === "vr" ? "VR" : "no VR"}` : "Decision made",
        (current) => ({
          ...current,
          vrChoice: choice,
          vrDecisionSource: source,
          step: choice === "vr" ? "vr-check" : "gear",
          stepStartedAt: Date.now()
        })
      );
    },
    [awardXp]
  );

  const flipCoin = () => {
    if (coinFlipping) return;
    setCoinFlipping(true);
    navigator.vibrate?.([20, 25, 20, 25, 20]);
    window.setTimeout(() => {
      chooseVr(Math.random() < 0.5 ? "vr" : "no-vr", "coin");
      setCoinFlipping(false);
    }, 900);
  };

  const completeVrCheck = () => {
    awardXp("vr-check", 20, "VR ready", (current) => ({
      ...current,
      step: "gear",
      stepStartedAt: Date.now()
    }));
  };

  const completeTimedStep = (step: "gear" | "shoes" | "water" | "mount") => {
    const current = loadBikeQuestState();
    if (!current || current.step !== step) return;
    const config = BIKE_TIMED_STEPS[step];
    const elapsed = Math.max(0, (Date.now() - current.stepStartedAt) / 1000);
    const xp = timedStepXp(
      elapsed,
      config.targetSeconds,
      config.graceSeconds,
      config.baseXp,
      config.bonusXp
    );
    const nextStep =
      step === "gear"
        ? "shoes"
        : step === "shoes"
          ? "pre-stretch"
          : step === "water"
            ? "mount"
            : "ride";
    const nextStartedAt = Date.now();
    const next = awardXp(
      `step-${step}`,
      xp,
      config.title,
      (awarded) => ({
        ...awarded,
        step: nextStep,
        stepStartedAt: nextStartedAt,
        rideStartedAt: step === "mount" ? nextStartedAt : awarded.rideStartedAt
      }),
      step === "mount"
    );
    if (step === "mount" && next?.step === "ride") void showBikeRideRunningNotification();
  };

  const startPreStretch = () => {
    const current = loadBikeQuestState();
    if (!current || current.step !== "pre-stretch") return;
    const elapsed = Math.max(0, (Date.now() - current.stepStartedAt) / 1000);
    const xp = immediateBonusXp(elapsed, PRE_STRETCH_BONUS_DRAIN_SECONDS, 20, 30);
    awardXp("pre-stretch-start", xp, "Started stretches", (awarded) => awarded);
    navigate({
      name: "yoga-class",
      classId: "before-cycling",
      returnToBikeQuest: "pre-stretch-complete"
    });
  };

  const logArmSet = () => {
    const current = loadBikeQuestState();
    if (!current || current.step !== "ride") return;
    const nextNumber = current.armSets + 1;
    awardXp(`arm-set-${nextNumber}`, ARM_SET_XP, `Arm set ${nextNumber}`, (awarded) => ({
      ...awarded,
      armSets: nextNumber
    }));
  };

  const endRide = () => {
    const current = loadBikeQuestState();
    if (!current?.rideStartedAt || current.step !== "ride" || current.awards.ride !== undefined) return;
    const endedAt = Date.now();
    const seconds = Math.max(1, Math.round((endedAt - current.rideStartedAt) / 1000));
    const rideXp = projectedRideXp(seconds);
    const next: BikeQuestState = {
      ...current,
      rideEndedAt: endedAt,
      rideSeconds: seconds,
      step: "recovery",
      stepStartedAt: endedAt,
      awards: { ...current.awards, ride: rideXp },
      totalQuestXp: current.totalQuestXp + rideXp
    };
    persistQuest(next);
    setData((currentData) => ({
      ...currentData,
      stats: addCompletedSession(currentData.stats, seconds)
    }));
    void cancelBikeRideNotification();
    celebrate("Ride complete", rideXp, true);
  };

  const startPostStretch = () => {
    navigate({
      name: "yoga-class",
      classId: "after-cycling",
      returnToBikeQuest: "post-stretch-complete"
    });
  };

  const skipPostStretch = () => {
    updateQuest((current) => ({ ...current, postStretchSkipped: true }));
  };

  const logShower = () => {
    const current = loadBikeQuestState();
    if (!current || current.showerLogged) return;
    awardXp("shower", 20, "Shower done", (awarded) => ({
      ...awarded,
      showerLogged: true,
      showerSkipped: false
    }));
  };

  const skipShower = () => {
    updateQuest((current) => ({ ...current, showerSkipped: true }));
  };

  const finishQuest = () => {
    updateQuest((current) => ({
      ...current,
      step: "complete",
      stepStartedAt: Date.now()
    }));
  };

  const elapsedForStep = quest ? Math.max(0, (now - quest.stepStartedAt) / 1000) : 0;
  const rideSeconds = quest?.rideStartedAt
    ? Math.max(1, Math.floor(((quest.rideEndedAt ?? now) - quest.rideStartedAt) / 1000))
    : 0;
  const liveRideXp = projectedRideXp(rideSeconds);

  const progress = useMemo(() => {
    if (!quest) return 0;
    const order = [
      "vr-choice",
      "vr-check",
      "gear",
      "shoes",
      "pre-stretch",
      "water",
      "mount",
      "ride",
      "recovery",
      "complete"
    ];
    return Math.max(0, order.indexOf(quest.step));
  }, [quest]);

  if (!quest) {
    return (
      <div className="screen-stack bike-quest intro">
        <section className="bike-quest-hero">
          <span className="bike-quest-hero-icon"><Bike /></span>
          <span className="eyebrow">Momentum over motivation</span>
          <h1>Bike Quest</h1>
          <p>One tiny action at a time. Every completed step pays XP; moving quickly only earns extra.</p>
        </section>
        <button className="button primary full bike-quest-launch" onClick={startQuest}>
          <Play fill="currentColor" /> Start Bike Quest
        </button>
      </div>
    );
  }

  const questHeader = (
    <div className="bike-quest-hud">
      <span><Bike size={16} /> Bike Quest</span>
      <span><b>+{quest.totalQuestXp}</b> XP this quest</span>
      <div className="bike-quest-progress">
        <span style={{ width: `${Math.min(100, (progress / 9) * 100)}%` }} />
      </div>
    </div>
  );

  if (quest.step === "vr-choice") {
    return (
      <div className="screen-stack bike-quest">
        {questHeader}
        <section className="bike-step-card vr-choice-card">
          <div className="bike-step-illustration"><Glasses size={82} /></div>
          <span className="eyebrow">Step 1</span>
          <h1>VR today?</h1>
          <p>If choosing feels like effort, outsource the decision to the stupid little coin.</p>
          <div className="bike-choice-grid">
            <button onClick={() => chooseVr("vr", "manual")}>
              <Glasses /> VR <small>+10 XP</small>
            </button>
            <button onClick={() => chooseVr("no-vr", "manual")}>
              <Bike /> No VR <small>+10 XP</small>
            </button>
          </div>
          <button
            className={`bike-coin ${coinFlipping ? "flipping" : ""}`}
            onClick={flipCoin}
            disabled={coinFlipping}
          >
            <span>{coinFlipping ? "?" : "I DON’T KNOW"}</span>
            <small>{coinFlipping ? "Fate is doing admin…" : "Flip for VR / no VR"}</small>
          </button>
        </section>
        <button className="button ghost full" onClick={resetQuest}>
          <RotateCcw size={17} /> Reset quest
        </button>
        {celebration ? <RewardBurst celebration={celebration} /> : null}
      </div>
    );
  }

  if (quest.step === "vr-check") {
    return (
      <div className="screen-stack bike-quest">
        {questHeader}
        <section className="bike-step-card">
          <img className="bike-step-image" src="assets/bike-quest/vr.webp" alt="VR headset on its stand" />
          <span className="eyebrow">VR prep</span>
          <h1>Wake the headset</h1>
          <p>Turn it on now. Check Holofit is updated before an enormous surprise download murders the plan.</p>
          <div className="bike-guarantee">
            <Check /> This step is worth XP even if Holofit needs an update.
          </div>
          <button className="button primary full" onClick={completeVrCheck}>
            Checked — ready <b>+20 XP</b>
          </button>
        </section>
        {celebration ? <RewardBurst celebration={celebration} /> : null}
      </div>
    );
  }

  if (["gear", "shoes", "water", "mount"].includes(quest.step)) {
    const step = quest.step as "gear" | "shoes" | "water" | "mount";
    const config = BIKE_TIMED_STEPS[step];
    const inTarget = elapsedForStep <= config.targetSeconds;
    const graceElapsed = Math.max(0, elapsedForStep - config.targetSeconds);
    const inGrace = !inTarget && graceElapsed < config.graceSeconds;
    const remaining = inTarget
      ? config.targetSeconds - elapsedForStep
      : Math.max(0, config.graceSeconds - graceElapsed);
    const progressFraction = inTarget
      ? elapsedForStep / config.targetSeconds
      : config.graceSeconds > 0
        ? graceElapsed / config.graceSeconds
        : 1;
    const currentXp = timedStepXp(
      elapsedForStep,
      config.targetSeconds,
      config.graceSeconds,
      config.baseXp,
      config.bonusXp
    );
    return (
      <div className="screen-stack bike-quest">
        {questHeader}
        <section className="bike-step-card">
          {config.image ? (
            <img className="bike-step-image" src={config.image} alt="" />
          ) : (
            <div className="bike-step-illustration"><Footprints size={82} /></div>
          )}
          <span className="eyebrow">One job. Do this now.</span>
          <h1>{config.title}</h1>
          <p>{config.instruction}</p>
          <div className={`bike-momentum ${inTarget ? "target" : inGrace ? "grace" : "base"}`}>
            <div
              className="bike-timer-ring"
              style={{ "--timer-progress": `${Math.min(1, progressFraction) * 360}deg` } as CSSProperties}
            >
              <strong>{formatClock(remaining)}</strong>
            </div>
            <div>
              <small>
                {inTarget
                  ? "Full momentum bonus safe"
                  : inGrace
                    ? "Bonus draining"
                    : "Bonus gone — base XP is safe"}
              </small>
              <strong>{currentXp} XP if completed now</strong>
              <span>{config.baseXp} XP guaranteed · up to {config.bonusXp} bonus</span>
            </div>
          </div>
          <button className="button primary full bike-done-button" onClick={() => completeTimedStep(step)}>
            <Check /> {config.buttonLabel} <b>+{currentXp} XP</b>
          </button>
        </section>
        {celebration ? <RewardBurst celebration={celebration} /> : null}
      </div>
    );
  }

  if (quest.step === "pre-stretch") {
    const startXp = immediateBonusXp(
      elapsedForStep,
      PRE_STRETCH_BONUS_DRAIN_SECONDS,
      20,
      30
    );
    const remaining = Math.max(0, PRE_STRETCH_BONUS_DRAIN_SECONDS - elapsedForStep);
    return (
      <div className="screen-stack bike-quest">
        {questHeader}
        <section className="bike-step-card">
          <img
            className="bike-step-image"
            src="assets/stretches/generated/indoor-cycling.png"
            alt="Indoor cycling warm-up illustration"
          />
          <span className="eyebrow">Yoga with Mark · 4 min</span>
          <h1>Pre-bike stretches</h1>
          <p>The stretch routine keeps its proper pace. The bonus timer only rewards how quickly you begin it.</p>
          <div className="bike-momentum grace">
            <div
              className="bike-timer-ring"
              style={{
                "--timer-progress": `${Math.min(1, elapsedForStep / PRE_STRETCH_BONUS_DRAIN_SECONDS) * 360}deg`
              } as CSSProperties}
            >
              <strong>{formatClock(remaining)}</strong>
            </div>
            <div>
              <small>Start bonus draining now</small>
              <strong>{startXp} XP for starting now</strong>
              <span>The Yoga class awards its normal completion XP as well.</span>
            </div>
          </div>
          <button className="button primary full" onClick={startPreStretch}>
            <Play fill="currentColor" /> Start Yoga with Mark <b>+{startXp} XP</b>
          </button>
        </section>
        {celebration ? <RewardBurst celebration={celebration} /> : null}
      </div>
    );
  }

  if (quest.step === "ride") {
    return (
      <div className="screen-stack bike-quest bike-ride-mode">
        {questHeader}
        <section className="bike-ride-stage">
          <img src="assets/bike-quest/bike.webp" alt="Exercise bike" />
          <span className="eyebrow">Ride live</span>
          <strong className="bike-ride-clock">{formatClock(rideSeconds)}</strong>
          <p>Keep going for however long is useful. Time only increases the reward.</p>
          <div className="bike-ride-xp">
            <Sparkles />
            <span><small>Ride XP building</small><strong>+{liveRideXp} XP</strong></span>
          </div>
          <button className="bike-arm-set" onClick={logArmSet}>
            <img src="assets/bike-quest/dumbbell.webp" alt="" />
            <span>
              <strong>Log arm set</strong>
              <small>{quest.armSets} logged · +{ARM_SET_XP} XP each</small>
            </span>
          </button>
          <button className="button primary full bike-end-ride" onClick={endRide}>END RIDE</button>
          <small className="bike-notification-note">
            <Clock3 size={14} /> Android keeps a Bike Quest notification visible while this timer is running.
          </small>
        </section>
        {celebration ? <RewardBurst celebration={celebration} /> : null}
      </div>
    );
  }

  if (quest.step === "recovery") {
    return (
      <div className="screen-stack bike-quest recovery">
        {questHeader}
        <section className="bike-ride-complete">
          <span className="completion-mark"><Trophy /></span>
          <span className="eyebrow">The bike part is already complete</span>
          <h1>{formatClock(quest.rideSeconds)} banked.</h1>
          <p>No optional step can take that away. The bits below are bonus quests only.</p>
          <div className="completion-reward-burst">
            <Sparkles />
            <span>
              <strong>+{quest.awards.ride ?? 0} ride XP</strong>
              <small>{quest.armSets} arm set{quest.armSets === 1 ? "" : "s"} logged</small>
            </span>
          </div>
        </section>

        <section className={`bike-bonus-card ${quest.postStretchCompleted ? "done" : ""}`}>
          <div className="bike-bonus-icon"><Footprints /></div>
          <div>
            <span className="eyebrow">Optional bonus</span>
            <h2>5-min warm-down</h2>
            <p>Run the existing After Cycling routine in Yoga with Mark.</p>
          </div>
          {quest.postStretchCompleted ? (
            <span className="bike-bonus-done"><Check /> Done</span>
          ) : quest.postStretchSkipped ? (
            <button className="button ghost" onClick={startPostStretch}>Changed my mind</button>
          ) : (
            <div className="bike-bonus-actions">
              <button className="button primary" onClick={startPostStretch}>Do warm-down</button>
              <button className="button ghost" onClick={skipPostStretch}>Skip</button>
            </div>
          )}
        </section>

        <section className={`bike-bonus-card ${quest.showerLogged ? "done" : ""}`}>
          <div className="bike-bonus-icon"><ShowerHead /></div>
          <div>
            <span className="eyebrow">Optional bonus</span>
            <h2>Shower</h2>
            <p>Useful when you need one; completely skippable when you do not.</p>
          </div>
          {quest.showerLogged ? (
            <span className="bike-bonus-done"><Check /> +20 XP</span>
          ) : quest.showerSkipped ? (
            <button className="button ghost" onClick={logShower}>Actually, showered</button>
          ) : (
            <div className="bike-bonus-actions">
              <button className="button primary" onClick={logShower}>Showered +20 XP</button>
              <button className="button ghost" onClick={skipShower}>Not needed</button>
            </div>
          )}
        </section>

        <button className="button primary full" onClick={finishQuest}>Finish Bike Quest</button>
        {celebration ? <RewardBurst celebration={celebration} /> : null}
      </div>
    );
  }

  return (
    <div className="screen-stack bike-quest complete">
      {questHeader}
      <section className="completion-screen bike-quest-final">
        <span className="completion-mark"><Check /></span>
        <span className="eyebrow">Bike Quest complete</span>
        <h1>{quest.totalQuestXp} quest XP banked.</h1>
        <p>
          {formatClock(quest.rideSeconds)} on the bike · {quest.armSets} arm set
          {quest.armSets === 1 ? "" : "s"}. The next quest starts from zero fuss.
        </p>
        <button className="button primary full" onClick={resetQuest}>
          <RotateCcw /> Start a fresh quest
        </button>
      </section>
      {celebration ? <RewardBurst celebration={celebration} /> : null}
    </div>
  );
}
