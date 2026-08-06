export interface GuidedAudioTrack {
  id: string;
  src: string;
  title: string;
  durationSeconds: number;
  voiceName: string;
  modelId: string;
}

const track = (
  id: string,
  title: string,
  durationSeconds: number
): GuidedAudioTrack => ({
  id,
  src: `assets/audio/meditations/${id}.ogg`,
  title,
  durationSeconds,
  voiceName: "adam owls soothing v2",
  modelId: "eleven_v3"
});

export const GUIDED_AUDIO_BY_MEDITATION: Record<string, GuidedAudioTrack[]> = {
  metta: [
    track("metta-v1-qda-v3", "Lanterns for Everyone", 570),
    track("metta-v2-qda-v3", "The Firefly Post Office", 570),
    track("metta-v3-qda-v3", "Paper Boats Under the Moon", 570),
    track("metta-v4-qda-v3", "The Weather Balloon Dispatch", 570)
  ],
  pratyahara: [
    track("pratyahara-v1-qda-v3", "The Quiet Side of the Signal", 600),
    track("pratyahara-v2-qda-v3", "Below the Blue Portholes", 600),
    track("pratyahara-v3-qda-v3", "The Library After Closing", 600),
    track("pratyahara-v4-qda-v3", "The Moon Garden Folds Its Petals", 600)
  ],
  nsdr: [
    track("nsdr-v1-qda-v3", "When the City Powers Down", 780),
    track("nsdr-v2-qda-v3", "The Last Train Enters the Depot", 780),
    track("nsdr-v3-qda-v3", "The Seaside Hotel Turns Down the Lights", 780),
    track("nsdr-v4-qda-v3", "The Observatory Closes for Dawn", 780)
  ],
  "sound-awareness": [
    track("sound-awareness-v1-qda-v3", "Radio Constellations", 405),
    track("sound-awareness-v2-qda-v3", "A Forest of Small Transmissions", 405),
    track("sound-awareness-v3-qda-v3", "Rain Builds an Orchestra", 405),
    track("sound-awareness-v4-qda-v3", "The Harbour of Listening Lights", 405)
  ],
  ego: [
    track("ego-v1-qda-v3", "The Sky Behind the Mirror", 540),
    track("ego-v2-qda-v3", "The Museum of Borrowed Costumes", 540),
    track("ego-v3-qda-v3", "The Name Tags in the Cloud Archive", 540),
    track("ego-v4-qda-v3", "The Theatre After the Applause", 540)
  ],
  ajna: [
    track("ajna-v1-qda-v3", "The Indigo Lighthouse", 720),
    track("ajna-v2-qda-v3", "The Violet Compass", 720),
    track("ajna-v3-qda-v3", "A Blue Window in the Snow", 720),
    track("ajna-v4-qda-v3", "The Planetarium's Violet Lens", 720)
  ],
  "urge-surfing": [
    track("urge-surfing-v1-qda-v3", "The Tide Does Not Give Orders", 540),
    track("urge-surfing-v2-qda-v3", "A Comet Does Not Need Chasing", 540),
    track("urge-surfing-v3-qda-v3", "The Train Can Leave Without You", 540),
    track("urge-surfing-v4-qda-v3", "The Storm Inside the Snow Globe", 540)
  ],
  acceptance: [
    track("acceptance-v4-qda-v3", "A Quiet Place for the Weather", 600),
    track("acceptance-v2-story-qda-v3", "The Museum of Unfinished Things", 600),
    track("acceptance-v3-story-qda-v3", "A River for the Fallen Leaves", 600),
    track("acceptance-v4-story-qda-v3", "The Repair Shop for Bent Constellations", 600)
  ],
  trataka: [
    track("trataka-v1-qda-v3", "A Friendly Star in the Flame", 740),
    track("trataka-v2-qda-v3", "The Ember in the Snow", 740),
    track("trataka-v3-qda-v3", "A Candle Beyond the Spaceship Glass", 740),
    track("trataka-v4-qda-v3", "The Lantern in the Crystal Cave", 740)
  ],
  "diaphragmatic-breathing": [
    track("diaphragmatic-breathing-v1-qda-v3", "The Garden Beneath the Ribs", 600),
    track("diaphragmatic-breathing-v2-qda-v3", "The Moonlit Accordion", 600),
    track("diaphragmatic-breathing-v3-qda-v3", "The Cave That Breathes with the Tide", 600),
    track("diaphragmatic-breathing-v4-qda-v3", "The Jellyfish Bell", 600)
  ],
  "focused-attention": [
    track("focused-attention-v1-qda-v3", "A Small Satellite Comes Home", 600),
    track("focused-attention-v2-qda-v3", "The Moth Finds the Porch Light", 600),
    track("focused-attention-v3-qda-v3", "One Clear Frequency", 600),
    track("focused-attention-v4-qda-v3", "The Telescope Chooses One Star", 600)
  ],
  grounding: [
    track("grounding-v1-qda-v3", "Five Coordinates Home", 600),
    track("grounding-v2-qda-v3", "The Campsite Check-In", 600),
    track("grounding-v3-qda-v3", "A Small Kitchen at Dawn", 600),
    track("grounding-v4-qda-v3", "The Night Market Map", 600)
  ],
  "yoga-nidra": [
    track("yoga-nidra-v1-qda-v3", "The Greenhouse of Sleeping Flowers", 1200),
    track("yoga-nidra-v2-qda-v3", "The Starship Sleep Deck", 1200),
    track("yoga-nidra-v3-qda-v3", "The Cabin Under Quiet Snow", 1200),
    track("yoga-nidra-v4-qda-v3", "The Moonlit Aquarium", 1200)
  ]
};

const LAST_VARIANT_KEY = "zenchad_last_guided_variant_v1";

function readLastVariants(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LAST_VARIANT_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function chooseGuidedAudioVariant(
  meditationId: string,
  preferredId?: string
): GuidedAudioTrack | undefined {
  const variants = GUIDED_AUDIO_BY_MEDITATION[meditationId] ?? [];
  const preferred = variants.find((variant) => variant.id === preferredId);
  if (preferred) return preferred;
  if (variants.length === 0) return undefined;

  const lastId = readLastVariants()[meditationId];
  const candidates = variants.length > 1
    ? variants.filter((variant) => variant.id !== lastId)
    : variants;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function rememberGuidedAudioVariant(meditationId: string, variantId: string) {
  try {
    const lastVariants = readLastVariants();
    lastVariants[meditationId] = variantId;
    localStorage.setItem(LAST_VARIANT_KEY, JSON.stringify(lastVariants));
  } catch {
    // Variant rotation is a convenience; playback still works if storage is unavailable.
  }
}
