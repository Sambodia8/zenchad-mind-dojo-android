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

  constructor(
    private readonly queueIds: readonly string[],
    private readonly tracks: readonly MeditationMusicTrack[],
    volume: number,
    private readonly onTrackChange: (track: MeditationMusicTrack) => void,
    private readonly onUnavailable: () => void
  ) {
    this.volume = this.clamp(volume);
    this.slots = [this.makeSlot(), this.makeSlot()];
    this.timeline = buildMusicTimeline(this.queueIds, this.tracks, this.failedTrackIds);
  }

  setVolume(volume: number) {
    this.volume = this.clamp(volume);
    this.sync(this.elapsedSeconds, this.shouldPlay);
  }

  sync(elapsedSeconds: number, shouldPlay: boolean) {
    this.elapsedSeconds = Math.max(0, elapsedSeconds);
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
    this.alignAndPlay(currentSlot, position.current, position.currentOffsetSeconds, currentGain);

    if (position.previous && position.previousOffsetSeconds !== undefined) {
      const previousSlot = this.slotFor(position.previous);
      const previousGain = Math.cos(position.crossfadeProgress * Math.PI / 2) * this.volume;
      this.alignAndPlay(previousSlot, position.previous, position.previousOffsetSeconds, previousGain);
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
      slot.audio.removeAttribute("src");
      slot.audio.load();
      slot.source.disconnect();
      slot.gain.disconnect();
    }
    void this.context.close();
  }

  private makeSlot(): PlayerSlot {
    const audio = new Audio();
    audio.preload = "metadata";
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
    gain: number
  ) {
    const changed = slot.entry !== entry;
    if (changed) {
      slot.audio.pause();
      slot.entry = entry;
      slot.audio.src = entry.track.src;
      slot.audio.load();
    }

    const target = Math.min(Math.max(0, offsetSeconds), Math.max(0, entry.track.durationSeconds - 0.05));
    if (changed || Math.abs(slot.audio.currentTime - target) > 0.9) {
      try {
        slot.audio.currentTime = target;
      } catch {
        slot.audio.addEventListener("loadedmetadata", () => {
          try { slot.audio.currentTime = target; } catch { /* Asset failed; error handler will skip it. */ }
        }, { once: true });
      }
    }
    this.setGain(slot, gain);
    if (slot.audio.paused) {
      void this.context.resume().then(() => slot.audio.play()).catch(() => {
        this.failedTrackIds.add(entry.track.id);
        this.timeline = buildMusicTimeline(this.queueIds, this.tracks, this.failedTrackIds);
        if (this.shouldPlay) this.sync(this.elapsedSeconds, true);
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
