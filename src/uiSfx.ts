export type UiSfxName =
  | "select"
  | "tab"
  | "confirm"
  | "back"
  | "wheelSpin"
  | "wheelLand"
  | "xpGain"
  | "victory"
  | "reward";

const SOURCES: Record<UiSfxName, string> = {
  select: "assets/audio/ui/select.mp3",
  tab: "assets/audio/ui/tab.mp3",
  confirm: "assets/audio/ui/confirm.mp3",
  back: "assets/audio/ui/back.mp3",
  wheelSpin: "assets/audio/ui/wheel-spin.mp3",
  wheelLand: "assets/audio/ui/wheel-land.mp3",
  xpGain: "assets/audio/ui/xp-roll.mp3",
  victory: "assets/audio/ui/victory.mp3",
  reward: "assets/audio/ui/menu-reward.mp3"
};

const VOLUMES: Record<UiSfxName, number> = {
  select: 0.25,
  tab: 0.62,
  confirm: 0.28,
  back: 0.45,
  wheelSpin: 0.26,
  wheelLand: 0.28,
  xpGain: 0.38,
  victory: 0.3,
  reward: 0.3
};

const players = new Map<UiSfxName, HTMLAudioElement>();
const prefetched = new Set<UiSfxName>();

function sourceUrl(name: UiSfxName) {
  return new URL(SOURCES[name], document.baseURI).toString();
}

function playerFor(name: UiSfxName) {
  const existing = players.get(name);
  if (existing) return existing;
  const player = new Audio();
  player.preload = "auto";
  player.src = sourceUrl(name);
  player.volume = VOLUMES[name];
  players.set(name, player);
  return player;
}

export function preloadUiSfx() {
  (Object.keys(SOURCES) as UiSfxName[]).forEach((name) => {
    if (prefetched.has(name)) return;
    prefetched.add(name);
    void fetch(sourceUrl(name), { cache: "force-cache" })
      .then((response) => response.arrayBuffer())
      .catch(() => {
        // The first explicit tap can still load the local asset on demand.
      });
  });
}

export function playUiSfx(name: UiSfxName, options?: { overlap?: boolean }) {
  try {
    if (options?.overlap) {
      const player = new Audio(sourceUrl(name));
      player.volume = Math.min(1, VOLUMES[name] * 0.55);
      void player.play().catch(() => {
        // Visual state always remains the source of truth if audio is unavailable.
      });
      return;
    }
    const player = playerFor(name);
    player.pause();
    player.currentTime = 0;
    void player.play().catch(() => {
      // Visual state always remains the source of truth if audio is unavailable.
    });
  } catch {
    // Some browsers block media before the first direct interaction.
  }
}

export function stopUiSfx(name: UiSfxName) {
  const player = players.get(name);
  if (!player) return;
  player.pause();
  player.currentTime = 0;
}
