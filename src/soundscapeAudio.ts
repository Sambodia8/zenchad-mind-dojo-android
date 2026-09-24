export interface MeditationMusicTrack {
  id: string;
  meditationId: string;
  src: string;
  title: string;
  variation: "a" | "b" | "c" | "d";
  provider: "ElevenLabs" | "Treblo";
  durationSeconds: number;
}

const MUSIC_DURATION_SECONDS: Record<string, number> = {
  "metta-music-a": 55.0065,
  "metta-music-b": 41.709979,
  "pratyahara-music-a": 41.013,
  "pratyahara-music-b": 41.292021,
  "nsdr-music-a": 41.013,
  "nsdr-music-b": 53.552146,
  "sound-awareness-music-a": 41.013,
  "sound-awareness-music-b": 43.5065,
  "ego-music-a": 41.013,
  "ego-music-b": 40.270333,
  "ajna-music-a": 41.013,
  "ajna-music-b": 43.846208,
  "urge-surfing-music-a": 55.0065,
  "urge-surfing-music-b": 41.245563,
  "acceptance-music-a": 41.013,
  "acceptance-music-b": 46.075333,
  "trataka-music-a": 55.0065,
  "trataka-music-b": 53.412833,
  "diaphragmatic-breathing-music-a": 41.013,
  "diaphragmatic-breathing-music-b": 39.527292,
  "focused-attention-music-a": 41.013,
  "focused-attention-music-b": 48.0065,
  "grounding-music-a": 41.013,
  "grounding-music-b": 44.217729,
  "yoga-nidra-music-a": 55.0065,
  "yoga-nidra-music-b": 49.836958
};

const music = (
  meditationId: string,
  variation: "a" | "b" | "c" | "d",
  title: string,
  provider: MeditationMusicTrack["provider"]
): MeditationMusicTrack => {
  const id = `${meditationId}-music-${variation}`;
  return {
  id,
  meditationId,
  src: `assets/audio/soundscapes/${meditationId}-music-${variation}.ogg`,
  title,
  variation,
  provider,
  durationSeconds: MUSIC_DURATION_SECONDS[id] ?? 300
  };
};

export const MUSIC_BY_MEDITATION: Record<string, MeditationMusicTrack[]> = {
  metta: [
    music("metta", "a", "Weather Balloons at Dusk", "ElevenLabs"),
    music("metta", "b", "Lavender Evening", "Treblo")
  ],
  pratyahara: [
    music("pratyahara", "a", "Quiet Spacecraft A", "ElevenLabs"),
    music("pratyahara", "b", "Quiet Spacecraft B", "Treblo")
  ],
  nsdr: [
    music("nsdr", "a", "Sleeping City A", "ElevenLabs"),
    music("nsdr", "b", "Sleeping City B", "Treblo")
  ],
  "sound-awareness": [
    music("sound-awareness", "a", "Celestial Radio A", "ElevenLabs"),
    music("sound-awareness", "b", "Celestial Radio B", "Treblo")
  ],
  ego: [
    music("ego", "a", "Open Sky and Windows A", "ElevenLabs"),
    music("ego", "b", "Open Sky and Windows B", "Treblo")
  ],
  ajna: [
    music("ajna", "a", "Indigo Lighthouse A", "ElevenLabs"),
    music("ajna", "b", "Indigo Lighthouse B", "Treblo")
  ],
  "urge-surfing": [
    music("urge-surfing", "a", "Luminous Tide A", "ElevenLabs"),
    music("urge-surfing", "b", "Luminous Tide B", "Treblo")
  ],
  acceptance: [
    music("acceptance", "a", "Inner Weather A", "ElevenLabs"),
    music("acceptance", "b", "Inner Weather B", "Treblo")
  ],
  trataka: [
    music("trataka", "a", "Crystal Cave Candle A", "ElevenLabs"),
    music("trataka", "b", "Crystal Cave Candle B", "Treblo")
  ],
  "diaphragmatic-breathing": [
    music("diaphragmatic-breathing", "a", "Underground Garden A", "ElevenLabs"),
    music("diaphragmatic-breathing", "b", "Underground Garden B", "Treblo")
  ],
  "focused-attention": [
    music("focused-attention", "a", "Patient Satellite A", "ElevenLabs"),
    music("focused-attention", "b", "Patient Satellite B", "Treblo")
  ],
  grounding: [
    music("grounding", "a", "Safe Ordinary Room A", "ElevenLabs"),
    music("grounding", "b", "Safe Ordinary Room B", "Treblo")
  ],
  "yoga-nidra": [
    music("yoga-nidra", "a", "Moonlit Aquarium A", "ElevenLabs"),
    music("yoga-nidra", "b", "Moonlit Aquarium B", "Treblo")
  ]
};

// The six approved five-minute pilot tracks are intentionally shared across
// every meditation until the remaining style-specific tracks can be produced.
// Their IDs and source paths remain canonical so one packaged asset can safely
// participate in every style's persisted queue.
export const SHARED_LONG_FORM_MUSIC: MeditationMusicTrack[] = [
  music("metta", "c", "Weather Balloons at Dusk — Long Drift", "ElevenLabs"),
  music("metta", "d", "Weather Balloons at Dusk — Long Horizon", "ElevenLabs"),
  music("sound-awareness", "c", "Celestial Radio — Long Drift", "ElevenLabs"),
  music("sound-awareness", "d", "Celestial Radio — Long Horizon", "ElevenLabs"),
  music("yoga-nidra", "c", "Moonlit Aquarium — Long Drift", "ElevenLabs"),
  music("yoga-nidra", "d", "Moonlit Aquarium — Long Horizon", "ElevenLabs")
];

export function musicTracksForMeditation(meditationId: string) {
  return [...(MUSIC_BY_MEDITATION[meditationId] ?? []), ...SHARED_LONG_FORM_MUSIC];
}

const LAST_MUSIC_KEY = "zenchad_last_meditation_music_v1";

function readLastMusic(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LAST_MUSIC_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function chooseMeditationMusic(
  meditationId: string,
  preferredId?: string
): MeditationMusicTrack | undefined {
  const tracks = musicTracksForMeditation(meditationId);
  const preferred = tracks.find((track) => track.id === preferredId);
  if (preferred) return preferred;
  if (tracks.length === 0) return undefined;

  const lastId = readLastMusic()[meditationId];
  const candidates = tracks.length > 1
    ? tracks.filter((track) => track.id !== lastId)
    : tracks;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function rememberMeditationMusic(meditationId: string, trackId: string) {
  try {
    const lastMusic = readLastMusic();
    lastMusic[meditationId] = trackId;
    localStorage.setItem(LAST_MUSIC_KEY, JSON.stringify(lastMusic));
  } catch {
    // Music rotation is a convenience; playback still works if storage is unavailable.
  }
}
