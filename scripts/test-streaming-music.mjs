import assert from "node:assert/strict";

const media = [];

class FakeAudio {
  constructor() {
    this.paused = true;
    this.readyState = 1;
    this.preload = "";
    this.src = "";
    this.position = 0;
    this.seeks = 0;
    this.plays = 0;
    this.loads = 0;
    this.deferPlay = false;
    media.push(this);
  }

  get currentTime() { return this.position; }
  set currentTime(value) { this.position = value; this.seeks += 1; }
  addEventListener() {}
  removeAttribute(name) { if (name === "src") this.src = ""; }
  load() { this.loads += 1; }
  pause() { this.paused = true; }
  play() {
    this.plays += 1;
    if (this.deferPlay) {
      return new Promise((resolve) => {
        this.finishPlay = () => { this.paused = false; resolve(); };
      });
    }
    this.paused = false;
    return Promise.resolve();
  }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.destination = {};
  }
  createMediaElementSource() {
    return { connect() {}, disconnect() {} };
  }
  createGain() {
    return {
      gain: {
        value: 0,
        cancelScheduledValues() {},
        setTargetAtTime(value) { this.value = value; }
      },
      connect() {},
      disconnect() {}
    };
  }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

globalThis.Audio = FakeAudio;
globalThis.AudioContext = FakeAudioContext;

const { StreamingMusicPlaylist } = await import("../src/streamingMusicPlaylist.ts");
const tracks = ["a", "b"].map((id) => ({
  id, meditationId: "pratyahara", src: `test-${id}.ogg`, title: id,
  durationSeconds: 45, variation: "a", provider: "ElevenLabs"
}));

const player = new StreamingMusicPlaylist(
  tracks.map((track) => track.id),
  tracks,
  0.5,
  () => {},
  () => assert.fail("Both tracks should remain available")
);
const [first, second] = media;
assert.equal(first.preload, "auto", "Music should buffer data, not just metadata");

// A slow play() promise should never spawn overlapping play() calls.
first.deferPlay = true;
player.sync(0, true);
await new Promise((resolve) => setImmediate(resolve));
player.sync(1, true);
player.sync(2, true);
assert.equal(first.plays, 1, "A pending Android play() request must be reused");
first.finishPlay();
await new Promise((resolve) => setImmediate(resolve));

// Deliberately create >1-second drift over successive normal timer ticks.
// The prior implementation repeatedly sought this audio, producing clicks.
const startSeeks = first.seeks;
for (let second = 3; second <= 12; second += 1) {
  first.position = second / 2;
  player.setVolume(0.5);
  player.sync(second, true);
}
assert.equal(first.seeks, startSeeks, "Normal timer ticks must not reseek playing music");
assert.equal(first.plays, 1, "Volume updates and timer ticks must not replay music");

// A genuine timer discontinuity must still seek to the new phase position.
player.sync(39, true);
assert.equal(second.src, "test-b.ogg", "Crossfade should start the next track");
assert(second.seeks >= 1, "New track should align to its timeline position");
const seeksAfterJump = first.seeks;
player.sync(40, true);
assert.equal(first.seeks, seeksAfterJump, "Crossfade ticks must not seek the previous track");

// Explicit pause/resume must restore both music streams to the session clock.
player.pause();
const resumeSeeks = first.seeks;
player.sync(41, true);
assert(first.seeks > resumeSeeks, "Resume should realign a previously paused stream");
player.dispose();

console.log("Streaming meditation music playback regression tests passed.");
