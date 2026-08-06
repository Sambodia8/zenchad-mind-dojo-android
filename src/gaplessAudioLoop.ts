export class GaplessAudioLoop {
  private source: AudioBufferSourceNode | null = null;
  private startedAt = 0;
  private startOffset = 0;
  private shouldPlay = false;
  private operation = 0;

  private constructor(
    private readonly context: AudioContext,
    private readonly buffer: AudioBuffer,
    private readonly gain: GainNode,
    private readonly onError: () => void
  ) {}

  static async load(src: string, volume: number, onError: () => void) {
    const context = new AudioContext();
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`Could not load gapless audio: ${response.status}`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      const gain = context.createGain();
      gain.gain.value = Math.min(1, Math.max(0, volume));
      gain.connect(context.destination);
      return new GaplessAudioLoop(context, buffer, gain, onError);
    } catch (error) {
      void context.close();
      throw error;
    }
  }

  setVolume(volume: number) {
    this.gain.gain.setTargetAtTime(
      Math.min(1, Math.max(0, volume)),
      this.context.currentTime,
      0.025
    );
  }

  sync(elapsedSeconds: number, shouldPlay: boolean) {
    this.shouldPlay = shouldPlay;
    if (!shouldPlay) {
      this.pause();
      return;
    }

    if (!this.source) {
      void this.playAt(elapsedSeconds);
      return;
    }

    const target = this.wrap(elapsedSeconds);
    const actual = this.wrap(
      this.startOffset + Math.max(0, this.context.currentTime - this.startedAt)
    );
    const directDifference = Math.abs(actual - target);
    const wrappedDifference = this.buffer.duration - directDifference;
    if (Math.min(directDifference, wrappedDifference) > 0.75) {
      void this.playAt(elapsedSeconds);
    }
  }

  pause() {
    this.shouldPlay = false;
    this.operation += 1;
    this.stopSource();
  }

  dispose() {
    this.pause();
    this.gain.disconnect();
    void this.context.close();
  }

  private async playAt(elapsedSeconds: number) {
    const operation = ++this.operation;
    this.shouldPlay = true;
    try {
      await this.context.resume();
      if (!this.shouldPlay || operation !== this.operation) return;

      this.stopSource();
      const source = this.context.createBufferSource();
      source.buffer = this.buffer;
      source.loop = true;
      source.connect(this.gain);
      const offset = this.wrap(elapsedSeconds);
      source.start(0, offset);
      this.source = source;
      this.startOffset = offset;
      this.startedAt = this.context.currentTime;
      source.onended = () => {
        if (this.source === source) this.source = null;
        source.disconnect();
      };
    } catch {
      this.shouldPlay = false;
      this.stopSource();
      this.onError();
    }
  }

  private stopSource() {
    const source = this.source;
    this.source = null;
    if (!source) return;
    source.onended = null;
    try {
      source.stop();
    } catch {
      // Already stopped.
    }
    source.disconnect();
  }

  private wrap(seconds: number) {
    if (this.buffer.duration <= 0) return 0;
    return Math.max(0, seconds) % this.buffer.duration;
  }
}
