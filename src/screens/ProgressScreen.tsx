import { CalendarDays, Clock3, Flame, Sparkles, Target, Trophy } from "lucide-react";
import type { AppData } from "../types";

interface Props {
  data: AppData;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatHours(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function ProgressScreen({ data }: Props) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const seconds = data.stats.weeklySeconds[dateKey(date)] ?? 0;
    return {
      label: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1),
      seconds
    };
  });
  const maxSeconds = Math.max(60, ...days.map((day) => day.seconds));
  const weeklyTotal = days.reduce((sum, day) => sum + day.seconds, 0);
  const beforeMoods = data.moods.filter((mood) => mood.stage === "before");
  const afterMoods = data.moods.filter((mood) => mood.stage === "after");
  const average = (entries: typeof beforeMoods) =>
    entries.length ? entries.reduce((sum, entry) => sum + entry.value, 0) / entries.length : null;
  const beforeAverage = average(beforeMoods);
  const afterAverage = average(afterMoods);

  return (
    <div className="screen-stack">
      <section className="page-intro">
        <span className="eyebrow">Activity analytics</span>
        <h1>Your mind reps</h1>
        <p>Progress is consistency, not perfection.</p>
      </section>

      <div className="stat-grid">
        <article className="stat-card"><Clock3 /><strong>{formatHours(data.stats.totalSeconds)}</strong><span>Total time</span></article>
        <article className="stat-card"><Target /><strong>{data.stats.sessionsCompleted}</strong><span>Sessions</span></article>
        <article className="stat-card"><Flame /><strong>{data.stats.streak}</strong><span>Day streak</span></article>
        <article className="stat-card"><b className="xp-stat-glyph">XP</b><strong>{data.stats.xp}</strong><span>Total XP</span></article>
      </div>

      <section className="card analytics-card">
        <div className="section-row">
          <div><span className="eyebrow">Last 7 days</span><h2>{formatHours(weeklyTotal)}</h2></div>
          <CalendarDays />
        </div>
        <div
          className={`bar-chart ${weeklyTotal === 0 ? "empty" : ""}`}
          aria-label="Meditation time for the last seven days"
        >
          {weeklyTotal === 0 ? (
            <div className="progress-zero-state">
              <Sparkles />
              <strong>Your first mark lands here</strong>
              <span>Any completed practice will bring this week to life.</span>
            </div>
          ) : (
            days.map((day, index) => (
              <div key={`${day.label}-${index}`}>
                <span className="bar-value">{day.seconds ? `${Math.round(day.seconds / 60)}m` : ""}</span>
                <i style={{ height: `${Math.max(6, (day.seconds / maxSeconds) * 100)}%` }} />
                <small>{day.label}</small>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="card mood-insight">
        <span className="eyebrow">Mood check-ins</span>
        <h2>Before → after</h2>
        {beforeAverage === null && afterAverage === null ? (
          <p>Complete check-ins around sessions to reveal a pattern here.</p>
        ) : (
          <>
            <div className="mood-comparison">
              <span><small>Before</small><strong>{beforeAverage?.toFixed(1) ?? "—"}</strong></span>
              <b>→</b>
              <span><small>After</small><strong>{afterAverage?.toFixed(1) ?? "—"}</strong></span>
            </div>
            <p>Shown on the same 0–10 check-in scale. These numbers describe your position, not a score.</p>
          </>
        )}
      </section>

      <section className="card reward-card">
        <Trophy />
        <div>
          <span className="eyebrow">Optional milestone</span>
          <h3>
            {data.stats.streak >= 7
              ? "You have meditated on seven consecutive days"
              : `A seven-day pattern is ${7 - data.stats.streak} days away — if it happens naturally`}
          </h3>
          <p>Missing a day never erases the time you have already spent or creates anything to catch up on.</p>
        </div>
      </section>
    </div>
  );
}
