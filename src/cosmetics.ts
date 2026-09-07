import type { AppData, CosmeticSlot } from "./types";

export type PaperDollLayerRole = Exclude<CosmeticSlot, "aura">;

export interface CosmeticDefinition {
  id: string;
  name: string;
  description: string;
  slot: CosmeticSlot;
  thumbnail: string;
  paperDollLayer?: string;
  paperDollRole?: PaperDollLayerRole;
  starter?: boolean;
  shopPrice?: number;
}

export const COSMETIC_CATALOGUE: readonly CosmeticDefinition[] = [
  {
    id: "default-pink-hair",
    name: "Original Pink Sweep",
    description: "ZenChad's original medium-long, side-swept bright pink hair.",
    slot: "hair",
    thumbnail: "/assets/status/generated/hair/default-pink-long-hair-clean.png",
    paperDollLayer: "/assets/status/paper-doll/layers/hair/default-pink-long-hair-clean.png",
    paperDollRole: "hair",
    starter: true
  },
  {
    id: "porter-robinson-nurture-hair",
    name: "Porter Robinson Nurture Hair",
    description: "Soft centre-parted blond hair inspired by Porter's Nurture era.",
    slot: "hair",
    thumbnail: "/assets/status/generated/hair/porter-robinson-nurture-hair.png",
    paperDollLayer: "/assets/status/paper-doll/layers/hair/porter-robinson-nurture-hair-clean.png",
    paperDollRole: "hair",
    shopPrice: 45
  },
  {
    id: "noodle-dare-hair",
    name: "Noodle DARE Hair",
    description: "The deep indigo, eye-skimming DARE-era Noodle silhouette.",
    slot: "hair",
    thumbnail: "/assets/status/generated/hair/noodle-dare-hair.png",
    paperDollLayer: "/assets/status/paper-doll/layers/hair/noodle-dare-hair-clean.png",
    paperDollRole: "hair",
    shopPrice: 50
  },
  {
    id: "silver-lilac-tousled-hair",
    name: "Silver Lilac Tousle",
    description: "Tousled medium-length hair in cool silver-lilac with periwinkle shadows and icy highlights.",
    slot: "hair",
    thumbnail: "/assets/status/generated/hair/silver-lilac-tousled-hair.png",
    paperDollLayer: "/assets/status/paper-doll/layers/hair/silver-lilac-tousled-hair-clean.png",
    paperDollRole: "hair",
    shopPrice: 55
  },
  {
    id: "runner-top",
    name: "Charcoal Training Top",
    description: "The original zip-front ZenChad training shirt.",
    slot: "top",
    thumbnail: "/assets/status/generated/core/top-charcoal-training-shirt.png",
    paperDollLayer: "/assets/status/paper-doll/layers/top/charcoal-training-shirt-clean.png",
    paperDollRole: "top",
    starter: true
  },
  {
    id: "cream-meditation-jacket",
    name: "Cream Meditation Jacket",
    description: "A calm cream jacket with indigo piping and a clean standing collar.",
    slot: "top",
    thumbnail: "/assets/status/generated/future/zenchad-cream-meditation-jacket.png",
    paperDollLayer: "/assets/status/paper-doll/layers/top/cream-meditation-jacket-clean.png",
    paperDollRole: "top",
    shopPrice: 65
  },
  {
    id: "fitness-watch",
    name: "Fitness Watch",
    description: "The original black training watch with a green pulse display.",
    slot: "wrist",
    thumbnail: "/assets/status/generated/effects/fitness-smartwatch.png",
    paperDollLayer: "/assets/status/paper-doll/layers/wrist/black-fitness-watch-clean.png",
    paperDollRole: "wrist",
    starter: true
  },
  {
    id: "hana-candy-bracelets",
    name: "Hana Candy Bracelets",
    description: "Three joyful rave kandi bracelets in Hana's candy colours.",
    slot: "wrist",
    thumbnail: "/assets/status/generated/wrist/hana-candy-bracelets.png",
    paperDollLayer: "/assets/status/paper-doll/layers/wrist/hana-candy-bracelets-clean.png",
    paperDollRole: "wrist",
    shopPrice: 35
  },
  {
    id: "katie-run-friendship-bracelet",
    name: "Katie Run Bracelet",
    description: "A hand-braided red, blue, teal and yellow friendship bracelet made for runs together.",
    slot: "wrist",
    thumbnail: "/assets/status/generated/wrist/katie-run-friendship-bracelet.png",
    paperDollLayer: "/assets/status/paper-doll/layers/wrist/katie-run-friendship-bracelet-clean.png",
    paperDollRole: "wrist",
    starter: true
  },
  {
    id: "runner-shorts",
    name: "Charcoal Training Shorts",
    description: "The original lightweight ZenChad training shorts.",
    slot: "legs",
    thumbnail: "/assets/status/generated/core/legs-charcoal-training-shorts.png",
    paperDollLayer: "/assets/status/paper-doll/layers/legs/charcoal-training-shorts-clean.png",
    paperDollRole: "legs",
    starter: true
  },
  {
    id: "red-trainers",
    name: "Black & Magenta Trainers",
    description: "The original rugged black trainers with magenta accents.",
    slot: "shoes",
    thumbnail: "/assets/status/generated/core/shoes-black-magenta-trainers.png",
    paperDollLayer: "/assets/status/paper-doll/layers/shoes/black-magenta-trainers-clean.png",
    paperDollRole: "shoes",
    starter: true
  },
  {
    id: "indigo-flow",
    name: "Indigo Flow Aura",
    description: "The original indigo spiritual flame surrounding ZenChad.",
    slot: "aura",
    thumbnail: "/assets/status/generated/effects/violet-spiritual-flame-aura.png",
    starter: true
  }
] as const;

const COSMETIC_BY_ID = new Map(COSMETIC_CATALOGUE.map((item) => [item.id, item]));

export function cosmeticById(id: string) {
  return COSMETIC_BY_ID.get(id);
}

export function cosmeticsForSlot(slot: CosmeticSlot) {
  return COSMETIC_CATALOGUE.filter((item) => item.slot === slot);
}

export function isCosmeticOwned(data: AppData, cosmeticId: string) {
  const item = cosmeticById(cosmeticId);
  return Boolean(item?.starter || (data.shopInventory[cosmeticId] ?? 0) > 0);
}

export function equipCosmetic(data: AppData, cosmeticId: string): AppData {
  const item = cosmeticById(cosmeticId);
  if (!item || !isCosmeticOwned(data, cosmeticId)) return data;
  return {
    ...data,
    progression: {
      ...data.progression,
      equippedCosmetics: {
        ...data.progression.equippedCosmetics,
        [item.slot]: item.id
      }
    }
  };
}
