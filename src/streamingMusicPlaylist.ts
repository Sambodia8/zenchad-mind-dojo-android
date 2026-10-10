import {
  buildMusicTimeline,
  locateMusicTimeline,
  type MusicTimelineEntry
} from "./meditationMusicPlaylist";
import type { MeditationMusicTrack } from "./soundscapeAudio";

interface PlayerSlot {
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  entry?: MusicTimelineEntry;
  pendingPlay?: Promise<void>;
}

export class StreamingMusicPlaylist {
  private readonly context = new AudioContext();
  private readonly slots: [PlayerSlot, PlayerSlot];
  private readonly failedTrackIds = new Set<string>();
  private timeline: MusicTimelineEntry[];
  private volume = 0;
  private shouldPlay = false;
  private elapsedSeconds = 0;
  private currentTrackId?: string;
  private readonly queueIds: readonly string[];
  private readonly tracks: readonly MeditationMusicTrack[];
  private readonly onTrackChange: (track: MeditationMusicTrack) => void;
  private readonly onUnavailable: () => void;

  constructor(
    queueIds: readonly string[],
    tracks: readonly MeditationMusicTrack[],
    volume: number,
    onTrackChange: (track: MeditationMusicTrack) => void,
    onUnavailable: () => void
  ) {
    this.queueIds = queueIds;
    this.tracks = tracks;
    this.onTrackChange = onTrackChange;
    this.onUnavailable = onUnavailable;
    this.volume = this.clamp(volume);
    this.slots = [this.makeSlot(), this.makeSlot()];
    this.timeline = buildMusicTimeline(this.queueIds, this.tracks, this.failedTrackIds);
  }

  setVolume(volume: number) {
    const nextVolume = this.clamp(volume);
    if (nextVolume === this.volume) return;
    this.volume = nextVolume;

    // A volume slider must never restart playback or seek the media elements.
    if (!this.shouldPlay) return;
    const position = locateMusicTimeline(this.timeline, this.elapsedSeconds);
    if (!position) return;
    for (const slot of this.slots) {
      if (slot.entry === position.current) {
        this.setGain(slot, position.previous
          ? Math.sin(position.crossfadeProgress * Math.PI / 2) * this.volume
          : this.volume);
      } else if (position.previous && slot.entry === position.previous) {
        this.setGain(slot, Math.cos(position.crossfadeProgress * Math.PI / 2) * this.volume);
      }
    }
  }

  sync(elapsedSeconds: number, shouldPlay: boolean) {
    const nextElapsed = Math.max(0, elapsedSeconds);
    // The timer rounds to whole seconds. Comparing it against a continuously
    // advancing media clock and seeking at ~1 second of drift caused audible
    // stuttering in Android WebView. Only reposition after a genuine timeline
    // jump (phase skip/background recovery) or a pause/resume.
    const needsResync = !this.shouldPlay
      || nextElapsed < this.elapsedSeconds - 1
      || nextElapsed > this.elapsedSeconds + 3;
    this.elapsedSeconds = nextElapsed;
    this.shouldPlay = shouldPlay;
    if (!shouldPlay) {
      this.pause();
      return;
    }

    const position = locateMusicTimeline(this.timeline, this.elapsedSeconds);
    if (!position) {
      this.pause();
      this.onUnavailable();
      return;
    }

    const currentSlot = this.slotFor(position.current);
    const currentGain = position.previous
      ? Math.sin(position.crossfadeProgress * Math.PI / 2) * this.volume
      : this.volume;
    this.alignAndPlay(currentSlot, position.current, position.currentOffsetSeconds, currentGain, needsResync);

    if (position.previous && position.previousOffsetSeconds !== undefined) {
      const previousSlot = this.slotFor(position.previous);
      const previousGain = Math.cos(position.crossfadeProgress * Math.PI / 2) * this.volume;
      this.alignAndPlay(previousSlot, position.previous, position.previousOffsetSeconds, previousGain, needsResync);
    }

    for (const slot of this.slots) {
      if (slot !== currentSlot && slot.entry !== position.previous) this.stopSlot(slot);
    }

    if (this.currentTrackId !== position.current.track.id) {
      this.currentTrackId = position.current.track.id;
      this.onTrackChange(position.current.track);
    }
  }

  pause() {
    this.shouldPlay = false;
    for (const slot of this.slots) {
      slot.audio.pause();
      this.setGain(slot, 0);
    }
  }

  dispose() {
    this.pause();
    for (const slot of this.slots) {
      slot.entry = undefined;
      slot.audio.removeAttribute("src");
      slot.audio.load();
      slot.source.disconnect();
      slot.gain.disconnect();
    }
    void this.context.close();
  }

  private makeSlot(): PlayerSlot {
    const audio = new Audio();
    audio.preload = "auto";
    const source = this.context.createMediaElementSource(audio);
    const gain = this.context.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.context.destination);
    const slot: PlayerSlot = { audio, source, gain };
    audio.addEventListener("error", () => {
      const failedId = slot.entry?.track.id;
      if (!failedId) return;
      this.failedTrackIds.add(failedId);
      slot.entry = undefined;
      this.timeline = buildMusicTimeline(this.queueIds, this.tracks, this.failedTrackIds);
      if (this.failedTrackIds.size >= new Set(this.tracks.map((track) => track.id)).size) {
        this.onUnavailable();
      } else if (this.shouldPlay) {
        this.sync(this.elapsedSeconds, true);
      }
    });
    return slot;
  }

  private slotFor(entry: MusicTimelineEntry) {
    const index = this.timeline.indexOf(entry);
    return this.slots[index % this.slots.length];
  }

  private alignAndPlay(
    slot: PlayerSlot,
    entry: MusicTimelineEntry,
    offsetSeconds: number,
    gain: number,
    needsResync: boolean
  ) {
    const changed = slot.entry !== entry;
    const target = Math.min(Math.max(0, offsetSeconds), Math.max(0, entry.track.durationSeconds - 0.05));
    if (changed) {
      slot.audio.pause();
      slot.entry = entry;
      slot.audio.src = entry.track.src;
      slot.audio.load();

      // Android can ignore currentTime assignments before the metadata arrives.
      // Seek once when the new file is ready, using the latest session position.
      slot.audio.addEventListener("loadedmetadata", () => {
        if (slot.entry !== entry || !this.shouldPlay) return;
        const liveOffset = Math.min(
          Math.max(0, this.elapsedSeconds - entry.startSeconds),
          Math.max(0, entry.track.durationSeconds - 0.05)
        );
        try { slot.audio.currentTime = liveOffset; } catch { /* Let playback recover naturally. */ }
      }, { once: true });
    }

    // Never chase the timer's rounded second-by-second reading while music is
    // running. Regular HTMLMediaElement playback is smoother and more accurate.
    if ((changed || needsResync) && slot.audio.readyState >= 1) {
      try { slot.audio.currentTime = target; } catch { /* Metadata handler will seek later. */ }
    }

    this.setGain(slot, gain);
    if (slot.audio.paused && !slot.pendingPlay) {
      // Only one resume/play attempt per slot. Repeated play() calls while the
      // promise is pending can abort each other on Android and sound like a loop.
      const attempt = this.context.resume()
        .then(async () => {
          if (!this.shouldPlay || slot.entry !== entry) return;
          await slot.audio.play();
          if (!this.shouldPlay || slot.entry !== entry) slot.audio.pause();
        })
        .catch(() => {
          // Audio focus/autoplay interruptions are transient. Only the media
          // element's error event should remove a genuinely broken asset.
        });
      slot.pendingPlay = attempt;
      void attempt.finally(() => {
        if (slot.pendingPlay === attempt) slot.pendingPlay = undefined;
      });
    }
  }

  private stopSlot(slot: PlayerSlot) {
    slot.audio.pause();
    slot.entry = undefined;
    this.setGain(slot, 0);
  }

  private setGain(slot: PlayerSlot, gain: number) {
    slot.gain.gain.cancelScheduledValues(this.context.currentTime);
    slot.gain.gain.setTargetAtTime(this.clamp(gain), this.context.currentTime, 0.08);
  }

  private clamp(value: number) {
    return Math.min(1, Math.max(0, value));
  }
}
