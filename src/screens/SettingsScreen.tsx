import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Bell, BellOff, Check, Download, Gauge, Moon, MoonStar, RefreshCw, Upload, Volume2, VolumeX } from "lucide-react";
import { cancelGentleReminder, scheduleGentleReminder } from "../native";
import type { AppData } from "../types";
import { exportSyncData, getDataSyncStatus, importSyncData } from "../syncBridge";
import type { SyncStatus } from "../sync";
import { RunningVoiceSettings } from "../components/RunningVoiceSettings";

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

  useEffect(() => { void getDataSyncStatus().then(setSyncStatus); }, []);


  const handleExport = async () => {
    setSyncBusy(true);
    const result = await exportSyncData(data);
    setSyncStatus(result.status);
    setMessage(result.ok ? "Data exported. Tasker can now upload the fixed sync file." : result.reason ?? "Export failed.");
    setSyncBusy(false);
  };

  const handleImport = async () => {
    setSyncBusy(true);
    const result = await importSyncData((next) => setData(next));
    setSyncStatus(result.status);
    setMessage(result.ok ? "Data imported and merged safely." : result.reason ?? "Import failed.");
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
          <span><RefreshCw /><span><strong>Data sync</strong><small>One shared ZenChad file keeps Android and desktop in step.</small></span></span>
        </div>
        <div className="sync-actions">
          <button type="button" className="button primary" onClick={handleExport} disabled={syncBusy}><Upload size={16} /> Export data</button>
          <button type="button" className="button secondary" onClick={handleImport} disabled={syncBusy}><Download size={16} /> Import data</button>
        </div>
        <p className="setting-note">Android file: <code>/storage/emulated/0/ZenChad/zenchad-sync.json</code>. Tasker transfers it to your Google Drive ZenChad folder.</p>
        {syncStatus.lastSuccessAt ? <small className="status-message"><Check /> Last successful sync {new Date(syncStatus.lastSuccessAt).toLocaleString()}</small> : null}
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
