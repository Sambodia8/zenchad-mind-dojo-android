import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Bell, BellOff, Check, Download, Gauge, Moon, MoonStar, RefreshCw, Upload, Volume2, VolumeX } from "lucide-react";
import { cancelGentleReminder, scheduleGentleReminder } from "../native";
import type { AppData } from "../types";
import { exportSyncData, getDataSyncStatus, importSyncData } from "../syncBridge";
import type { SyncStatus } from "../sync";
import { RunningVoiceSettings } from "../components/RunningVoiceSettings";
import { loadZenCoachProfile, saveZenCoachProfile, type ZenCoachProfile } from "../zenCoach";
import { saveRunDebriefs } from "../runningHype";
import { loadZenCoachNotificationSettings, refreshZenCoachNotification, setZenCoachNotificationEnabled, updateZenCoachNotificationSettings, type ZenCoachNotificationSettings } from "../zenCoachNotifications";

interface Props {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
}

export default function SettingsScreen({ data, setData }: Props) {
  const [message, setMessage] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => ({
    configured: false, lastAction: null, lastSuccessAt: null, lastError: null, sourceDeviceId: ""
  }));
  const [syncBusy, setSyncBusy] = useState(false);
  const [coachProfile, setCoachProfile] = useState(loadZenCoachProfile);
  const [coachNotifications, setCoachNotifications] = useState(loadZenCoachNotificationSettings);
  const [coachNotificationMessage, setCoachNotificationMessage] = useState("");

  const updateCoachProfile = (change: Partial<ZenCoachProfile>) => {
    const next = { ...coachProfile, ...change };
    saveZenCoachProfile(next);
    setCoachProfile(next);
    void refreshZenCoachNotification();
  };

  const toggleCoachNotifications = async () => {
    const result = await setZenCoachNotificationEnabled(!coachNotifications.enabled);
    setCoachNotifications(loadZenCoachNotificationSettings());
    setCoachNotificationMessage(result.ok
      ? coachNotifications.enabled ? "Adventure reminders are off." : "Adventure reminders are on. Quiet hours and rest choices are respected."
      : result.reason ?? "The reminder could not be enabled.");
  };

  const changeCoachNotificationSettings = async (change: Partial<Omit<ZenCoachNotificationSettings, "enabled">>) => {
    const result = await updateZenCoachNotificationSettings(change);
    setCoachNotifications(loadZenCoachNotificationSettings());
    if (!result.ok) setCoachNotificationMessage(result.reason ?? "Choose a valid time.");
    else setCoachNotificationMessage("");
  };

  useEffect(() => { void getDataSyncStatus().then(setSyncStatus); }, []);


  const handleExport = async () => {
    setSyncBusy(true);
    const result = await exportSyncData(data);
    setSyncStatus(result.status);
    setMessage(result.reason ?? (result.ok ? "Backup saved." : "Export failed."));
    setSyncBusy(false);
  };

  const handleImport = async () => {
    setSyncBusy(true);
    const result = await importSyncData((next) => setData(next));
    setSyncStatus(result.status);
    setMessage(result.ok ? "Data imported and merged safely." : result.reason ?? "Import failed.");
    if (result.ok) void refreshZenCoachNotification();
    setSyncBusy(false);
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
            <Moon />
            <span>
              <strong>Appearance</strong>
              <small>Always-on dark purple mode keeps the app consistent and readable</small>
            </span>
          </span>
        </div>
        <p className="setting-note appearance-summary">The pale daytime theme has been retired so every screen uses the same dark-purple visual language.</p>
      </section>

      <section className="card settings-sheet sync-sheet">
        <div className="setting-row illustrated-setting">
          <span><RefreshCw /><span><strong>Backup & restore</strong><small>Save your journal, progress and settings in one file.</small></span></span>
        </div>
        <div className="sync-actions">
          <button type="button" className="button primary" onClick={handleExport} disabled={syncBusy}><Upload size={16} /> Export data</button>
          <button type="button" className="button secondary" onClick={handleImport} disabled={syncBusy}><Download size={16} /> Import data</button>
        </div>
        <p className="setting-note">Export data opens “Save as”. Choose Downloads or a Drive folder, then tap Save. Import data lets you choose an existing ZenChad backup. No “all files access” permission is needed.</p>
        {syncBusy && <p className="status-message" role="status">Choose a file location in the Android picker to continue, or cancel to return.</p>}
        {message && <p className="status-message" role="status">{message}</p>}
        {syncStatus.lastSuccessAt ? <small className="status-message"><Check /> Last successful backup or restore {new Date(syncStatus.lastSuccessAt).toLocaleString()}</small> : null}
        {syncStatus.lastError ? <small className="status-message sync-error">{syncStatus.lastError}</small> : null}
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

      <RunningVoiceSettings data={data} setData={setData} />

      <section className="card settings-sheet zen-coach-settings" aria-labelledby="zen-coach-settings-title">
        <div className="setting-row illustrated-setting">
          <span><Gauge /><span><strong id="zen-coach-settings-title">Zen Coach</strong><small>Local suggestions based on completed workouts</small></span></span>
        </div>
        <label className="setting-input">
          Sessions in a rolling week
          <select value={coachProfile.weeklyTarget} onChange={(event) => updateCoachProfile({ weeklyTarget: Number(event.target.value) })}>
            {[1, 2, 3, 4, 5, 6, 7].map((target) => <option value={target} key={target}>{target}</option>)}
          </select>
        </label>
        <label className="setting-input">
          Activity preference
          <select value={coachProfile.preferredActivity} onChange={(event) => updateCoachProfile({ preferredActivity: event.target.value as ZenCoachProfile["preferredActivity"] })}>
            <option value="auto">Mix runs and rides</option>
            <option value="run">Prefer running</option>
            <option value="bike">Prefer cycling</option>
          </select>
        </label>
        <label className="setting-input">
          Route preference
          <select value={coachProfile.novelty} onChange={(event) => updateCoachProfile({ novelty: event.target.value as ZenCoachProfile["novelty"] })}>
            <option value="balanced">Balanced</option>
            <option value="familiar">Familiar today</option>
            <option value="surprise">Surprise me</option>
          </select>
        </label>
        <label className="setting-input">
          Circuit's style
          <select value={coachProfile.coachStyle} onChange={(event) => updateCoachProfile({ coachStyle: event.target.value as ZenCoachProfile["coachStyle"] })}>
            <option value="off">Off</option>
            <option value="minimal">Minimal</option>
            <option value="calm">Calm</option>
            <option value="enthusiastic">Enthusiastic</option>
            <option value="dry-humor">Dry humor</option>
          </select>
        </label>
        <div className="zen-coach-settings-actions">
          {coachProfile.restUntil && coachProfile.restUntil > Date.now() ? <button type="button" className="button secondary" onClick={() => updateCoachProfile({ restUntil: null })}>End rest day</button> : null}
          <button type="button" className="button secondary" onClick={() => { updateCoachProfile({ feedback: [], decisions: [] }); saveRunDebriefs({}); }}>Clear coaching feedback</button>
        </div>
        <p className="setting-note">Suggestions and feedback stay on this device. Clearing feedback resets what Circuit has learned from your choices; completed workouts remain in your history.</p>
      </section>

      <section className="card settings-sheet zen-coach-settings" aria-labelledby="zen-coach-reminder-title">
        <div className="setting-row illustrated-setting">
          <span>{coachNotifications.enabled ? <Bell /> : <BellOff />}<span><strong id="zen-coach-reminder-title">Adventure reminder</strong><small>One specific local suggestion when a session is due</small></span></span>
          <button type="button" className={`toggle ${coachNotifications.enabled ? "on" : ""}`} onClick={() => void toggleCoachNotifications()} aria-label="Toggle Zen Coach adventure reminder" aria-pressed={coachNotifications.enabled}><span /></button>
        </div>
        <label className="setting-input">Preferred time
          <input type="time" value={coachNotifications.time} onChange={(event) => void changeCoachNotificationSettings({ time: event.target.value })} />
        </label>
        <label className="zen-coach-quiet-toggle"><input type="checkbox" checked={coachNotifications.quietHoursEnabled} onChange={(event) => void changeCoachNotificationSettings({ quietHoursEnabled: event.target.checked })} /> Quiet hours</label>
        {coachNotifications.quietHoursEnabled ? <div className="zen-coach-quiet-times">
          <label className="setting-input">From<input type="time" value={coachNotifications.quietStart} onChange={(event) => void changeCoachNotificationSettings({ quietStart: event.target.value })} /></label>
          <label className="setting-input">Until<input type="time" value={coachNotifications.quietEnd} onChange={(event) => void changeCoachNotificationSettings({ quietEnd: event.target.value })} /></label>
        </div> : null}
        <p className="setting-note">Off by default. Android will ask before the first reminder. Rest, snooze, a completed workout, or a met weekly goal stops the pending suggestion.</p>
        {coachNotificationMessage ? <p className="status-message" role="status">{coachNotificationMessage}</p> : null}
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
