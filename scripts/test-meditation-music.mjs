import assert from "node:assert/strict";
import {
  MUSIC_CROSSFADE_SECONDS,
  MUSIC_CYCLE_COUNTER_KEY,
  buildMusicQueueIds,
  buildMusicQueueIdsForCounter,
  buildMusicTimeline,
  locateMusicTimeline,
  readMusicCycleCounter,
  takeNextMusicCycleCounter
} from "../src/meditationMusicPlaylist.ts";
import {
  MUSIC_BY_MEDITATION,
  SHARED_LONG_FORM_MUSIC,
  musicTracksForMeditation
} from "../src/soundscapeAudio.ts";

const tracks = ["a", "b", "c", "d"].map((variation, index) => ({
  id: `test-music-${variation}`,
  meditationId: "test",
  src: `test-${variation}.ogg`,
  title: `Test ${variation.toUpperCase()}`,
  variation,
  provider: "ElevenLabs",
  durationSeconds: index < 2 ? 45 : 300
}));

const values = [0.91, 0.12, 0.72, 0.31, 0.83, 0.2, 0.64, 0.44];
let randomIndex = 0;
const queue = buildMusicQueueIds(tracks, 1200, () => values[randomIndex++ % values.length]);
assert(queue.length >= 8, "A twenty-minute session should contain more than one shuffle cycle.");

for (let start = 0; start + 4 <= queue.length; start += 4) {
  assert.equal(new Set(queue.slice(start, start + 4)).size, 4, "Every shuffle cycle must play all four tracks exactly once.");
  if (start > 0) assert.notEqual(queue[start], queue[start - 1], "Cycle boundaries must not immediately repeat a track.");
}

const preferred = buildMusicQueueIds(tracks, 60, () => 0.5, "test-music-c");
assert.equal(preferred[0], "test-music-c", "Legacy/restored preferred tracks should remain first.");

const simpleTimeline = buildMusicTimeline(["test-music-a", "test-music-b"], tracks);
assert.equal(simpleTimeline[1].startSeconds, 45 - MUSIC_CROSSFADE_SECONDS);
const overlap = locateMusicTimeline(simpleTimeline, 40);
assert.equal(overlap?.current.track.id, "test-music-b");
assert.equal(overlap?.previous?.track.id, "test-music-a");
assert(overlap && overlap.crossfadeProgress > 0 && overlap.crossfadeProgress < 1);

const failedTimeline = buildMusicTimeline(queue, tracks, new Set(["test-music-b"]));
assert(failedTimeline.every((entry) => entry.track.id !== "test-music-b"), "Failed tracks must be removed from the active timeline.");

const sharedTracks = [...tracks, ...["e", "f", "g", "h"].map((variation) => ({
  id: `shared-music-${variation}`,
  meditationId: "shared",
  src: `shared-${variation}.ogg`,
  title: `Shared ${variation.toUpperCase()}`,
  variation: variation === "e" || variation === "g" ? "c" : "d",
  provider: "ElevenLabs",
  durationSeconds: 300
}))];
const stored = new Map();
const storage = {
  getItem: (key) => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value)
};
assert.equal(readMusicCycleCounter(storage), 0);
assert.equal(stored.has(MUSIC_CYCLE_COUNTER_KEY), false, "Reading an unopened session's order must not consume the counter.");
const firstCounter = takeNextMusicCycleCounter(storage);
const secondCounter = takeNextMusicCycleCounter(storage);
assert.equal(firstCounter, 0);
assert.equal(secondCounter, 1);
assert.equal(stored.get(MUSIC_CYCLE_COUNTER_KEY), "2", "The cycle counter must persist its next value.");
const firstCounterQueue = buildMusicQueueIdsForCounter(sharedTracks, 600, firstCounter);
const restoredCounterQueue = buildMusicQueueIdsForCounter(sharedTracks, 600, firstCounter);
const secondCounterQueue = buildMusicQueueIdsForCounter(sharedTracks, 600, secondCounter);
assert.deepEqual(restoredCounterQueue, firstCounterQueue, "The same persisted counter must restore the same order.");
assert.notDeepEqual(secondCounterQueue, firstCounterQueue, "The next persisted counter must rotate the order.");
assert.equal(new Set(firstCounterQueue.slice(0, 8)).size, 8, "Every shared-track cycle must play all eight tracks before repeating.");

for (const meditationId of Object.keys(MUSIC_BY_MEDITATION)) {
  const catalogue = musicTracksForMeditation(meditationId);
  assert.equal(catalogue.length, 8, `${meditationId} must expose local A/B plus all six long tracks.`);
  assert.equal(new Set(catalogue.map((track) => track.id)).size, 8, `${meditationId} must not contain duplicate track IDs.`);
  for (const shared of SHARED_LONG_FORM_MUSIC) {
    assert(catalogue.some((track) => track.id === shared.id), `${meditationId} is missing ${shared.id}.`);
  }
}

console.log(`Meditation music shuffle and persistent-counter tests passed for ${queue.length} queued entries.`);
