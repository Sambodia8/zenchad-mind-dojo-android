export interface MeditationMusicTrack {
  id: string;
  meditationId: string;
  src: string;
  title: string;
  variation: "a" | "b";
  provider: "ElevenLabs" | "Treblo";
}

const music = (
  meditationId: string,
  variation: "a" | "b",
  title: string,
  provider: MeditationMusicTrack["provider"]
): MeditationMusicTrack => ({
  id: `${meditationId}-music-${variation}`,
  meditationId,
  src: `assets/audio/soundscapes/${meditationId}-music-${variation}.ogg`,
  title,
  variation,
  provider
});

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
  const tracks = MUSIC_BY_MEDITATION[meditationId] ?? [];
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
