import { Cloud, Download, Play, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  getRunningSpeechVoices,
  preferredRunningSpeechVoice,
  runningSpeechVoiceDescription,
  setRunningSpeechVoice,
  speakRunningNavigation,
  subscribeToRunningSpeechVoices,
  type RunningSpeechVoice
} from "../runningSpeech";
import type { AppData } from "../types";

export function RunningVoiceSettings({
  data,
  setData,
  compact = false
}: {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  compact?: boolean;
}) {
  const [voices, setVoices] = useState<RunningSpeechVoice[]>([]);
  const [sampleStatus, setSampleStatus] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getRunningSpeechVoices().then((next) => {
        if (active) setVoices(next);
      });
    };
    refresh();
    const unsubscribe = subscribeToRunningSpeechVoices(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setRunningSpeechVoice(data.preferences.runningSpeechVoiceId);
  }, [data.preferences.runningSpeechVoiceId]);

  const recommended = useMemo(() => preferredRunningSpeechVoice(voices), [voices]);
  const selected = voices.find((voice) => voice.id === data.preferences.runningSpeechVoiceId) ?? null;
  const activeVoice = selected ?? recommended;
  const activeDescription = runningSpeechVoiceDescription(activeVoice);

  const playSample = async () => {
    setSampleStatus("Playing sample…");
    await speakRunningNavigation("Running navigation voice sample. In one hundred and thirty five metres, turn left.");
    setSampleStatus("Sample played");
  };

  return (
    <section className={`card settings-sheet running-voice-settings ${compact ? "compact" : ""}`} aria-labelledby={compact ? "running-hub-voice-title" : "running-settings-voice-title"}>
      <div className="setting-row illustrated-setting">
        <span><Volume2 /><span><strong id={compact ? "running-hub-voice-title" : "running-settings-voice-title"}>Running voice</strong><small>Active voice: {activeDescription}</small></span></span>
      </div>
      <label className="setting-input">
        Navigation voice
        <select
          value={data.preferences.runningSpeechVoiceId ?? ""}
          onChange={(event) => setData((current) => ({
            ...current,
            preferences: { ...current.preferences, runningSpeechVoiceId: event.target.value || null }
          }))}
          aria-label="Running navigation voice"
        >
          <option value="">{recommended ? `Automatic · ${runningSpeechVoiceDescription(recommended)}` : "Automatic · local system default"}</option>
          {voices.map((voice) => (
            <option key={voice.id} value={voice.id} disabled={voice.installed === false}>
              {voice.name} · {voice.localeLabel || voice.lang} · {voice.networkRequired ? "Internet required" : "Offline"}{voice.default ? " · System default" : ""}{voice.installed === false ? " · Not installed" : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="running-voice-meta">
        {activeVoice?.networkRequired ? <><Cloud /><span>This selected voice needs internet. Navigation falls back to a local voice if it fails.</span></> : <><Download /><span>Offline-ready for outdoor navigation.</span></>}
      </div>
      <button type="button" className="button secondary" onClick={() => void playSample()} aria-label="Play running navigation voice sample"><Play size={16} /> Play sample</button>
      {!voices.length ? <p className="setting-note" role="status">Waiting for Android's speech engine. Navigation uses the local system default if the voice list cannot load.</p> : null}
      {sampleStatus ? <small className="status-message" role="status" aria-live="polite">{sampleStatus}</small> : null}
    </section>
  );
}
