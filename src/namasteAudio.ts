export interface NamasteEnding {
  id: string;
  title: string;
  src: string;
}

export const NAMASTE_ENDINGS: NamasteEnding[] = [
  { id: "namaste-softly", title: "Softly", src: "assets/audio/endings/namaste-softly.ogg" },
  { id: "namaste-warmly", title: "Warmly", src: "assets/audio/endings/namaste-warmly.ogg" },
  {
    id: "namaste-reassuringly",
    title: "Reassuringly",
    src: "assets/audio/endings/namaste-reassuringly.ogg"
  },
  {
    id: "namaste-thoughtfully",
    title: "Thoughtfully",
    src: "assets/audio/endings/namaste-thoughtfully.ogg"
  }
];

const LAST_ENDING_KEY = "zenchad_last_namaste_ending_v1";

export function chooseNamasteEnding(preferredId?: string) {
  if (preferredId) {
    const preferred = NAMASTE_ENDINGS.find((ending) => ending.id === preferredId);
    if (preferred) return preferred;
  }

  const lastId = localStorage.getItem(LAST_ENDING_KEY);
  const candidates = NAMASTE_ENDINGS.filter((ending) => ending.id !== lastId);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? NAMASTE_ENDINGS[0];
}

export function rememberNamasteEnding(id: string) {
  localStorage.setItem(LAST_ENDING_KEY, id);
}
