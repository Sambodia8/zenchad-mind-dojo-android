import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Headphones, Pause, Play, Volume2, Waves, Download, CheckCircle2, Loader2 } from "lucide-react";
import type { AppData } from "../types";

const soundscapes = [
  { id: "rain", name: "Rain Temple", note: "Soft filtered rain", frequency: 700, tone: "rain" },
  { id: "ocean", name: "Ocean Hush", note: "Slow, wide waves", frequency: 360, tone: "ocean" },
  { id: "forest", name: "Forest Morning", note: "Gentle leafy air", frequency: 1050, tone: "forest" },
  { id: "ember", name: "Warm Ember", note: "Low cosy texture", frequency: 220, tone: "ember" },
  { id: "focus", name: "Binaural Focus", note: "Headphones recommended", frequency: 520, tone: "focus" }
];

interface Props {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
}

export default function SoundscapesScreen({ data, setData }: Props) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [volume, setVolume] = useState(35);
  const [downloading, setDownloading] = useState<string | null>(null);
  const audioRef = useRef<{
    context: AudioContext;
    source: AudioBufferSourceNode;
    gain: GainNode;
    lfo: OscillatorNode;
  } | null>(null);

  const stop = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.source.stop();
      audio.lfo.stop();
      void audio.context.close();
    }
    audioRef.current = null;
    setPlaying(null);
  };

  useEffect(() => () => {
    const audio = audioRef.current;
    if (audio) {
      audio.source.stop();
      audio.lfo.stop();
      void audio.context.close();
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.gain.gain.setTargetAtTime(volume / 250, audioRef.current.context.currentTime, 0.08);
    }
  }, [volume]);

  const play = (id: string, frequency: number) => {
    if (playing === id) {
      stop();
      return;
    }
    stop();
    const context = new AudioContext();
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    const gain = context.createGain();
    gain.gain.value = volume / 250;
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.frequency.value = id === "ocean" ? 0.09 : 0.18;
    lfoGain.gain.value = 0.08;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start();
    lfo.start();
    audioRef.current = { context, source, gain, lfo };
    setPlaying(id);
  };

  const handleDownload = (id: string) => {
    setDownloading(id);
    setTimeout(() => {
      setData((prev) => ({
        ...prev,
        downloadedSoundscapes: [...(prev.downloadedSoundscapes || []), id]
      }));
      setDownloading(null);
    }, 1500);
  };

  return (
    <div className="screen-stack soundscape-screen">
      <section className="page-intro">
        <span className="eyebrow">Listen offline</span>
        <h1>Soundscapes</h1>
        <p>Simple generated audio textures. No connection, account or attention required.</p>
      </section>

      <div className="soundscape-list">
        {soundscapes.map((soundscape) => {
          const isDownloaded = data.downloadedSoundscapes?.includes(soundscape.id);
          const isDownloading = downloading === soundscape.id;

          return (
            <article className={`soundscape-card ${soundscape.tone}`} key={soundscape.id}>
              <span className="soundscape-art"><Waves /></span>
              <div style={{ flex: 1 }}>
                <strong>{soundscape.name}</strong>
                <small>{soundscape.note}</small>
                {isDownloaded && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--brand)', fontSize: '0.75rem', marginTop: '4px' }}>
                    <CheckCircle2 size={12} /> <span>Ready Offline</span>
                  </div>
                )}
              </div>
              
              {!isDownloaded && (
                <button
                  className="button subtle small"
                  onClick={() => handleDownload(soundscape.id)}
                  disabled={isDownloading !== false && downloading !== null}
                  style={{ marginRight: '0.5rem', opacity: isDownloading ? 0.7 : 1 }}
                  title="Download for offline listening"
                >
                  {isDownloading ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
                </button>
              )}

              <button
                className="sound-play"
                onClick={() => play(soundscape.id, soundscape.frequency)}
                aria-label={`${playing === soundscape.id ? "Pause" : "Play"} ${soundscape.name}`}
              >
                {playing === soundscape.id ? <Pause /> : <Play fill="currentColor" />}
              </button>
            </article>
          );
        })}
      </div>

      <label className="card volume-card">
        <span><Volume2 /> Volume</span>
        <input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
        <b>{volume}%</b>
      </label>
      <p className="headphone-note"><Headphones /> Keep the volume comfortable. Binaural Focus is most effective in stereo.</p>
    </div>
  );
}
