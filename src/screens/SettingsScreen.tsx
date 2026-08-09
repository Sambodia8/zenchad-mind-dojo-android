import { useState, type Dispatch, type SetStateAction } from "react";
import { Bell, BellOff, Check, Clock, Gauge, Moon, MoonStar, Sun, Volume2, VolumeX } from "lucide-react";
import { cancelGentleReminder, scheduleGentleReminder } from "../native";
import { setAppearanceMode } from "../theme";
import type { AppearanceMode, AppData } from "../types";

interface Props {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
}

export default function SettingsScreen({ data, setData }: Props) {
  const [message, setMessage] = useState("");

  const setAppearance = (appearanceMode: AppearanceMode) => {
    setAppearanceMode(appearanceMode);
    setData((current) => ({
      ...current,
      preferences: { ...current.preferences, appearanceMode }
    }));
  };

  const toggleReminder = async () => {
    if (data.preferences.gentleReminderEnabled) {
      await cancelGentleReminder();
      setData((current) => ({
        ...current,
        preferences: { ...current.preferences, gentleReminderEnabled: false }
      }));
      setMessage("Gentle reminder turned off.");
      return;
    }
    const result = await scheduleGentleReminder(data.preferences.gentleReminderTime);
    if (result.ok) {
      setData((current) => ({
        ...current,
        preferences: { ...current.preferences, gentleReminderEnabled: true }
      }));
      setMessage("A single gentle reminder is ready.");
    } else {
      setMessage(result.reason ?? "The reminder could not be enabled.");
    }
  };

  const appearanceMode = data.preferences.appearanceMode;

  return (
    <div className="screen-stack settings-screen">
      <section className="page-intro">
        <span className="eyebrow">Make it comfortable</span>
        <h1>Settings</h1>
        <p>Calm defaults, clear choices, and no attention traps.</p>
      </section>

      <section className="card settings-sheet">
        <div className="setting-row illustrated-setting">
          <span>
            {appearanceMode === "light" ? <Sun /> : appearanceMode === "dark" ? <Moon /> : <Clock />}
            <span>
              <strong>Appearance</strong>
              <small>Use a bright daytime look and a calmer dark palette at night</small>
            </span>
          </span>
        </div>
        <div className="segmented three appearance-segmented" role="group" aria-label="Appearance mode">
          <button
            type="button"
            className={appearanceMode === "light" ? "active" : ""}
            onClick={() => setAppearance("light")}
            aria-pressed={appearanceMode === "light"}
          >
            <Sun size={16} /> Light
          </button>
          <button
            type="button"
            className={appearanceMode === "auto" ? "active" : ""}
            onClick={() => setAppearance("auto")}
            aria-pressed={appearanceMode === "auto"}
          >
            <Clock size={16} /> Auto
          </button>
          <button
            type="button"
            className={appearanceMode === "dark" ? "active" : ""}
            onClick={() => setAppearance("dark")}
            aria-pressed={appearanceMode === "dark"}
          >
            <Moon size={16} /> Dark
          </button>
        </div>
        <p className="setting-note appearance-summary">
          Auto uses your device's local time: light from 07:00, dark from 19:00.
        </p>
      </section>

      <section className="card settings-sheet">
        <div className="setting-row illustrated-setting">
          <span>
            {data.preferences.uiSoundsEnabled ? <Volume2 /> : <VolumeX />}
            <span>
              <strong>Interface sounds</strong>
              <small>Soft feedback for taps, tabs and the roulette dial</small>
            </span>
          </span>
          <button
            className={`toggle ${data.preferences.uiSoundsEnabled ? "on" : ""}`}
            onClick={() =>
              setData((current) => ({
                ...current,
                preferences: {
                  ...current.preferences,
                  uiSoundsEnabled: !current.preferences.uiSoundsEnabled
                }
              }))
            }
            data-sfx={data.preferences.uiSoundsEnabled ? "select" : "enable"}
            aria-label="Toggle interface sounds"
          >
            <span />
          </button>
        </div>
      </section>

      <section className="card settings-sheet">
        <div className="setting-row illustrated-setting">
          <span>{data.preferences.gentleReminderEnabled ? <Bell /> : <BellOff />}<span><strong>Gentle reminder</strong><small>One invitation, never a warning</small></span></span>
          <button className={`toggle ${data.preferences.gentleReminderEnabled ? "on" : ""}`} onClick={toggleReminder} aria-label="Toggle gentle reminder"><span /></button>
        </div>
        <label className="setting-input">
          Reminder time
          <input
            type="time"
            value={data.preferences.gentleReminderTime}
            onChange={(event) => setData((current) => ({
              ...current,
              preferences: { ...current.preferences, gentleReminderTime: event.target.value }
            }))}
          />
        </label>
        {message ? <small className="status-message"><Check /> {message}</small> : null}
      </section>

      <section className="card settings-sheet">
        <div className="setting-row illustrated-setting">
          <span><Gauge /><span><strong>Reduce motion</strong><small>Shorter transitions and no decorative drift</small></span></span>
          <button
            className={`toggle ${data.preferences.reducedMotion ? "on" : ""}`}
            onClick={() => setData((current) => ({
              ...current,
              preferences: { ...current.preferences, reducedMotion: !current.preferences.reducedMotion }
            }))}
            aria-label="Toggle reduced motion"
          ><span /></button>
        </div>
        <p className="setting-note">Android's system reduced-motion preference is respected automatically, too.</p>
      </section>

      <section className="card privacy-note">
        <MoonStar />
        <div><strong>Private by default</strong><p>Your journal, moods and progress stay on this device. The core app continues to work offline.</p></div>
      </section>
    </div>
  );
}
