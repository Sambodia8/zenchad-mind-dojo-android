export interface CelebrationParticle {
  x: number;
  startY: number;
  width: number;
  height: number;
  hue: number;
  duration: number;
  delay: number;
  driftA: number;
  driftB: number;
  driftC: number;
  spin: number;
  flutter: number;
  round: number;
}

function seedHash(seed: string) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function seededRandom(seed: string) {
  let value = seedHash(seed) || 0x9e3779b9;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ next >>> 15, next | 1);
    next ^= next + Math.imul(next ^ next >>> 7, next | 61);
    return ((next ^ next >>> 14) >>> 0) / 4294967296;
  };
}

export function createCelebrationParticles(seed: string, count = 88): CelebrationParticle[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const direction = random() > 0.5 ? 1 : -1;
    return {
      x: -3 + random() * 106,
      startY: -18 - random() * 150,
      width: 5 + random() * 8,
      height: 7 + random() * 15,
      hue: random() * 360,
      duration: 2.15 + random() * 2.85,
      delay: random() * 1.75,
      driftA: direction * (12 + random() * 76),
      driftB: -direction * (8 + random() * 94),
      driftC: direction * (6 + random() * 112),
      spin: direction * (420 + random() * 1440),
      flutter: 0.42 + random() * 1.15,
      round: random() > 0.78 ? 999 : 1 + random() * 4
    };
  });
}
