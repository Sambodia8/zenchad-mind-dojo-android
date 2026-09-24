import { useEffect, useRef, useState } from "react";
import { Volume2, Square, Wind } from "lucide-react";
import type { Meditation } from "../types";
import { BREATHING_PREVIEWS } from "../breathingPreviews";

export default function BreathingGuidanceCard({ meditation, volume, running }: {
  meditation: Meditation; volume: number; running: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");
  const preview = BREATHING_PREVIEWS[meditation.id];
  const stop = () => { audioRef.current?.pause(); setPlaying(false); };
  useEffect(() => {
    if (!preview) return;
    const audio = new Audio(preview.src);
    audio.preload = "metadata";
    const onTime = () => {
      if (audio.currentTime >= preview.start + preview.duration) {
        audio.pause(); setPlaying(false);
      }
    };
    audio.addEventListener("timeupdate", onTime);
    audio.onended = () => setPlaying(false);
    audio.onerror = () => { setPlaying(false); setMessage("The voice could not play. Follow the written instructions below."); };
    audioRef.current = audio;
    return () => {
      audio.pause(); audio.removeEventListener("timeupdate", onTime);
      audio.onended = null; audio.onerror = null;
      audio.removeAttribute("src"); audio.load(); audioRef.current = null;
    };
  }, [preview]);
  useEffect(() => { if (running) stop(); }, [running]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume / 100; }, [volume]);
  const play = async () => {
    if (playing) { stop(); return; }
    if (volume <= 0) { setMessage("Voice volume is muted. Raise Voice volume below to hear the instructions."); return; }
    const audio = audioRef.current;
    if (!audio || !preview) return;
    setMessage("");
    try {
      audio.currentTime = preview.start;
      audio.volume = volume / 100;
      setPlaying(true);
      await audio.play();
    } catch { setPlaying(false); setMessage("The voice could not play. Follow the written instructions below."); }
  };
  if (!meditation.breathingGuidance) return null;
  return <section className="card breathing-guidance-card">
    <div className="breathing-guidance-title"><Wind size={19} /><span><small>How to breathe</small><strong>{meditation.breathingGuidance.name}</strong></span></div>
    <p>{meditation.breathingGuidance.instruction}</p>
    {meditation.id === "nsdr" && <ol className="nsdr-instructions">
      <li>Lie down comfortably, or sit supported. Close your eyes if comfortable.</li>
      <li>Take three easy breaths: inhale gently, then let the exhale last a little longer. No breath holds or forced deep breaths.</li>
      <li>Let breathing return to its own rhythm. Follow the voice as it moves attention through your feet, legs, torso, arms and face. You do not need to move or tense those areas.</li>
      <li>If attention wanders, return to the body part being named. During quiet gaps, simply rest. You do not need to fall asleep.</li>
    </ol>}
    <small>{meditation.breathingGuidance.safetyNote}</small>
    {preview && <button className="button secondary" onClick={() => void play()} disabled={running}>
      {playing ? <Square size={17} /> : <Volume2 size={17} />}{playing ? "Stop instructions" : "Hear breathing instructions"}
    </button>}
    {preview && <small>Listen before starting; this does not start the timer. Pause the session to replay.</small>}
    {message && <p className="status-message" role="status">{message}</p>}
  </section>;
}
