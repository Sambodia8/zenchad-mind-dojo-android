import {
  Award,
  BookHeart,
  Check,
  Flame,
  Flower2,
  HeartHandshake,
  LockKeyhole,
  Moon,
  RotateCw,
  Sparkles,
  Star,
  TimerReset,
  WandSparkles
} from "lucide-react";
import type { AppData } from "../types";

interface Props {
  data: AppData;
}

const questPageProgress = (value: number, target: number) =>
  value === 0 ? 0 : value % target || target;

export default function RewardsScreen({ data }: Props) {
  const badges = [
    {
      name: "Minimum Viable Session",
      note: "You showed up. Tiny absolutely counts.",
      icon: Sparkles,
      current: data.stats.sessionsCompleted,
      target: 1
    },
    {
      name: "First Step",
      note: "Your first practice is in the book.",
      icon: Flower2,
      current: data.stats.sessionsCompleted,
      target: 1
    },
    {
      name: "Focused Follower",
      note: "Five sessions, each chosen on purpose.",
      icon: Star,
      current: data.stats.sessionsCompleted,
      target: 5
    },
    {
      name: "Roulette Disciple",
      note: "You let curiosity choose three times.",
      icon: RotateCw,
      current: data.stats.rouletteSpins,
      target: 3
    },
    {
      name: "Deep Rest",
      note: "Twenty minutes made room for recovery.",
      icon: Moon,
      current: data.stats.totalSeconds,
      target: 1200,
      progressLabel: `${Math.min(20, Math.floor(data.stats.totalSeconds / 60))}/20 min`
    },
    {
      name: "Stretch Sage",
      note: "Three complete movement classes.",
      icon: WandSparkles,
      current: data.stats.yogaSessions,
      target: 3
    },
    {
      name: "Emotional Alchemist",
      note: "Four honest check-ins changed the map.",
      icon: BookHeart,
      current: data.moods.length,
      target: 4
    },
    {
      name: "Weekly Warrior",
      note: "A seven-day rhythm appeared naturally.",
      icon: Flame,
      current: data.stats.streak,
      target: 7
    },
    {
      name: "Constellation Keeper",
      note: "A dozen practices made a constellation.",
      icon: HeartHandshake,
      current: data.stats.sessionsCompleted,
      target: 12,
      hidden: true
    },
    {
      name: "Time Bender",
      note: "An hour of practice, gathered gently.",
      icon: TimerReset,
      current: data.stats.totalSeconds,
      target: 3600,
      hidden: true
    }
  ];
  const questProgress = questPageProgress(data.stats.sessionsCompleted, 3);
  const checkInCount = data.moods.filter((item) => item.stage === "before").length;
  const checkIns = questPageProgress(checkInCount, 3);
  const unlockedCount = badges.filter((badge) => badge.current >= badge.target).length;

  return (
    <div className="screen-stack rewards-screen">
      <section className="page-intro">
        <span className="eyebrow">Collect moments, not pressure</span>
        <h1>Quests & badges</h1>
        <p>Visible progress, odd little secrets, and no punishment for disappearing.</p>
      </section>

      <section className="card weekly-quest-card">
        <div className="section-row">
          <div>
            <span className="eyebrow">Current quest page</span>
            <h2>Three small arrivals</h2>
          </div>
          <Award />
        </div>
        <p>Complete any three practices. One minute still earns a stamp.</p>
        <div className="quest-stamps" aria-label={`${questProgress} of 3 practices`}>
          {[0, 1, 2].map((item) => (
            <span className={item < questProgress ? "done" : ""} key={item}>
              {item < questProgress ? <Check /> : item + 1}
            </span>
          ))}
        </div>
        <div className="progress-track">
          <span style={{ width: `${(questProgress / 3) * 100}%` }} />
        </div>
        <small>
          {questProgress === 3
            ? "Page complete — the next practice starts a fresh one."
            : `${3 - questProgress} invitation${3 - questProgress === 1 ? "" : "s"} left on this page.`}
        </small>
      </section>

      <section className="card weekly-quest-card compact-quest">
        <div>
          <strong>Notice three moods</strong>
          <small>{checkIns} of 3 compassionate check-ins</small>
        </div>
        <div className="progress-track">
          <span style={{ width: `${(checkIns / 3) * 100}%` }} />
        </div>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Illustrated keepsakes</span>
            <h2>Your badge cabinet</h2>
          </div>
          <span>{unlockedCount} / {badges.length}</span>
        </div>
        <div className="badge-garden">
          {badges.map((badge) => {
            const unlocked = badge.current >= badge.target;
            const hidden = Boolean(badge.hidden && !unlocked);
            const Icon = hidden ? LockKeyhole : badge.icon;
            const percent = Math.min(100, (badge.current / badge.target) * 100);
            return (
              <article
                className={`badge-card ${unlocked ? "unlocked pulse-once" : ""} ${hidden ? "secret" : ""}`}
                key={badge.name}
                style={{ 
                  animationDelay: `${badges.indexOf(badge) * 50}ms`,
                  boxShadow: unlocked ? '0 4px 12px rgba(38, 196, 133, 0.15)' : 'none',
                  borderColor: unlocked ? 'var(--brand)' : 'var(--border)'
                }}
              >
                <span className="badge-medallion" style={{ 
                  background: unlocked ? 'var(--brand)' : 'var(--card-bg)', 
                  color: unlocked ? '#fff' : 'var(--text-muted)' 
                }}>
                  <Icon />
                </span>
                <strong>{hidden ? "Hidden keepsake" : badge.name}</strong>
                <small>
                  {unlocked
                    ? badge.note
                    : hidden
                      ? "Its clue appears when you get close."
                      : badge.note}
                </small>
                {!unlocked ? (
                  <div className="badge-progress">
                    <span style={{ width: `${percent}%` }} />
                    <small>
                      {badge.progressLabel ?? `${Math.min(badge.current, badge.target)}/${badge.target}`}
                    </small>
                  </div>
                ) : (
                  <span className="badge-earned"><Check size={14} /> Earned</span>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
