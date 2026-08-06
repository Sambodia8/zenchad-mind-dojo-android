import { useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowRight,
  Bell,
  BellOff,
  BookOpen,
  Check,
  Dumbbell,
  Flame,
  Gift,
  Music2,
  MessageCircleHeart,
  Sparkles,
  Target
} from "lucide-react";
import { LEVEL_THRESHOLDS, MEDITATIONS } from "../data";
import { cancelGentleReminder, scheduleGentleReminder } from "../native";
import { makeMood } from "../storage";
import type { AppData, Route } from "../types";

interface Props {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  navigate: Dispatch<SetStateAction<Route>>;
}

const moods = [
  { label: "Overwhelmed", color: "#c86259" },
  { label: "Very rough", color: "#ca6d5d" },
  { label: "Struggling", color: "#d47a5f" },
  { label: "Tense", color: "#d98964" },
  { label: "Unsettled", color: "#dca36a" },
  { label: "Neutral", color: "#deb96c" },
  { label: "Steady", color: "#b8b775" },
  { label: "Okay", color: "#9caf82" },
  { label: "Calm", color: "#86aa8d" },
  { label: "Good", color: "#74a59b" },
  { label: "Grounded", color: "#6b9fa7" }
];

const recommendationIds = [
  "nsdr",
  "nsdr",
  "acceptance",
  "acceptance",
  "grounding",
  "sound-awareness",
  "focused-attention",
  "metta",
  "pratyahara",
  "trataka",
  "frisson"
];

export default function HomeScreen({ data, setData, navigate }: Props) {
  const [moodValue, setMoodValue] = useState(5);
  const [moodNote, setMoodNote] = useState("");
  const [savedMood, setSavedMood] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const recommendation = MEDITATIONS.find((item) => item.id === recommendationIds[moodValue])!;
  const nextLevel = LEVEL_THRESHOLDS[data.stats.level] ?? LEVEL_THRESHOLDS.at(-1)!;
  const previousLevel = LEVEL_THRESHOLDS[Math.max(0, data.stats.level - 1)] ?? 0;
  const levelProgress = Math.min(
    100,
    ((data.stats.xp - previousLevel) / Math.max(1, nextLevel - previousLevel)) * 100
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const tinyQuestComplete = data.stats.lastSessionDate === todayKey;

  const saveMood = () => {
    setData((current) => ({
      ...current,
      moods: [makeMood("before", moodValue, moodNote.trim()), ...current.moods]
    }));
    setSavedMood(true);
  };

  const updateReminderTime = (time: string) => {
    setData((current) => ({
      ...current,
      preferences: { ...current.preferences, gentleReminderTime: time }
    }));
    setNotificationMessage(
      data.preferences.gentleReminderEnabled ? "Tap “Update reminder” to use the new time." : ""
    );
  };

  const toggleReminder = async () => {
    if (data.preferences.gentleReminderEnabled) {
      await cancelGentleReminder();
      setData((current) => ({
        ...current,
        preferences: { ...current.preferences, gentleReminderEnabled: false }
      }));
      setNotificationMessage("Gentle reminder turned off.");
      return;
    }

    const result = await scheduleGentleReminder(data.preferences.gentleReminderTime);
    if (result.ok) {
      setData((current) => ({
        ...current,
        preferences: { ...current.preferences, gentleReminderEnabled: true }
      }));
      setNotificationMessage("Gentle reminder scheduled. You can turn it off here at any time.");
    } else {
      setNotificationMessage(result.reason ?? "The reminder could not be enabled.");
    }
  };

  const rescheduleReminder = async () => {
    const result = await scheduleGentleReminder(data.preferences.gentleReminderTime);
    setNotificationMessage(
      result.ok ? "Reminder time updated." : result.reason ?? "The reminder could not be updated."
    );
  };

  return (
    <div className="screen-stack">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">{greeting}, Atlas</span>
          <h1>Meet yourself<br />where you are.</h1>
          <p>One gentle practice is plenty for today.</p>
          <button
            className="button primary hero-action"
            onClick={() => navigate({ name: "guide" })}
          >
            <MessageCircleHeart size={19} /> Find my practice
          </button>
        </div>
        <div className="mascot-frame">
          <img
            src="assets/vision2/zen-chad-mascot.png"
            alt="Zen Chad meditating on a lavender lotus"
          />
          <div className="level-orb" aria-label={`Growth level ${data.stats.level}`}>
            <small>LEVEL</small>
            <strong>{data.stats.level}</strong>
          </div>
        </div>
      </section>

      <section className="card level-card">
        <div className="section-row">
          <span><b className="xp-glyph">XP</b> {data.stats.xp}</span>
          <span><Flame size={18} /> {data.stats.streak} day rhythm</span>
        </div>
        <div className="progress-track"><span style={{ width: `${levelProgress}%` }} /></div>
        <small>
          {Math.max(0, nextLevel - data.stats.xp)} growth points to the next chapter. Nothing to catch up.
        </small>
      </section>

      <section className={`card home-quest-card ${tinyQuestComplete ? "complete" : ""}`}>
        <span className="home-quest-seal">
          {tinyQuestComplete ? <Check /> : <Gift />}
        </span>
        <div>
          <span className="eyebrow">Today&apos;s tiny quest</span>
          <h3>{tinyQuestComplete ? "Quest complete. Nice." : "Let the brass oracle choose"}</h3>
          <p>
            {tinyQuestComplete
              ? "You collected today’s stamp. Nothing else is required."
              : "Turn the dial and try whatever it points to — even for one minute."}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() =>
            navigate(
              tinyQuestComplete
                ? { name: "rewards" }
                : { name: "roulette", autoSpin: true, spinKey: Date.now() }
            )
          }
        >
          {tinyQuestComplete ? "See rewards" : "Ask the dial"} <ArrowRight size={17} />
        </button>
      </section>

      <section className="card mood-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Quick check-in</span>
            <h2>How are you arriving?</h2>
          </div>
          <span className="mood-dot" style={{ background: moods[moodValue].color }} />
        </div>
        <p className="mood-guidance">Pick the closest number. It is a snapshot, not a test.</p>
        <div className="mood-labels">
          <span>0 · hardest</span><span>5 · neutral</span><span>10 · best</span>
        </div>
        <input
          className="mood-slider"
          type="range"
          min="0"
          max="10"
          step="1"
          value={moodValue}
          aria-label="Current mood"
          onChange={(event) => {
            setMoodValue(Number(event.target.value));
            setSavedMood(false);
          }}
        />
        <strong className="current-mood">
          <span>{moodValue}/10</span> {moods[moodValue].label}
        </strong>
        <textarea
          rows={2}
          value={moodNote}
          onChange={(event) => setMoodNote(event.target.value)}
          placeholder="Optional: what is taking up space in your head?"
        />
        <div className="recommendation">
          <span className="recommendation-icon"><Sparkles size={20} /></span>
          <div>
            <small>Suggested right now</small>
            <strong>{recommendation.name}</strong>
            <p>{recommendation.benefit}</p>
          </div>
          <button
            className="icon-button"
            onClick={() => navigate({ name: "timer", meditationId: recommendation.id })}
            aria-label={`Start ${recommendation.name}`}
          >
            <ArrowRight size={20} />
          </button>
        </div>
        <button className="button secondary full" onClick={saveMood}>
          {savedMood ? "Check-in saved" : "Save check-in"}
        </button>
      </section>

      <section>
        <div className="section-heading">
          <div><span className="eyebrow">Fast routes</span><h2>Do something now</h2></div>
        </div>
        <div className="action-grid">
          <button className="action-card violet" onClick={() => navigate({ name: "roulette" })}>
            <Target />
            <span><strong>Spin the wheel</strong><small>Let chance choose</small></span>
            <ArrowRight size={18} />
          </button>
          <button
            className="action-card teal"
            onClick={() => navigate({ name: "yoga" })}
          >
            <Dumbbell />
            <span><strong>Yoga with Mark</strong><small>Choose a class for right now</small></span>
            <ArrowRight size={18} />
          </button>
          <button
            className="action-card orange"
            onClick={() => navigate({ name: "timer", meditationId: "trataka" })}
          >
            <Flame />
            <span><strong>Candle gaze</strong><small>Trataka focus mode</small></span>
            <ArrowRight size={18} />
          </button>
          <button className="action-card blue" onClick={() => navigate({ name: "journal" })}>
            <BookOpen />
            <span><strong>Journal</strong><small>Capture the after-effect</small></span>
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <section className="card reminder-card">
        <span className="feature-icon">
          {data.preferences.gentleReminderEnabled ? <Bell /> : <BellOff />}
        </span>
        <div>
          <span className="eyebrow">Entirely optional</span>
          <h3>One gentle daily reminder</h3>
          <p>
            A quiet invitation at a time you choose. No streak warnings, guilt, urgency, or repeated nudges.
          </p>
          <div className="reminder-controls">
            <input
              type="time"
              value={data.preferences.gentleReminderTime}
              onChange={(event) => updateReminderTime(event.target.value)}
              aria-label="Gentle reminder time"
            />
            <button className="button secondary" onClick={toggleReminder}>
              {data.preferences.gentleReminderEnabled ? "Turn off" : "Enable"}
            </button>
            {data.preferences.gentleReminderEnabled && (
              <button className="button ghost" onClick={rescheduleReminder}>Update reminder</button>
            )}
          </div>
          {notificationMessage && <small className="status-message">{notificationMessage}</small>}
        </div>
      </section>

      <section className="card coming-soon playlist-callout">
        <span className="feature-icon"><Music2 /></span>
        <div>
          <span className="eyebrow">Your saved listening</span>
          <h3>Guided favourites and sound playlists</h3>
          <p>The list and durations stay available offline; YouTube playback needs a connection.</p>
          <button
            className="button secondary"
            onClick={() => navigate({ name: "library", tab: "guided" })}
          >
            Open your playlists <ArrowRight size={17} />
          </button>
        </div>
      </section>
    </div>
  );
}
