import type { AppData, CosmeticSlot } from "./types";
import { DEFAULT_EQUIPPED_COSMETICS } from "./progression";

export type PaperDollLayerRole = Exclude<CosmeticSlot, "aura">;

export interface CosmeticDefinition {
  id: string;
  name: string;
  description: string;
  slot: CosmeticSlot;
  thumbnail?: string;
  paperDollLayer?: string;
  paperDollRole?: PaperDollLayerRole;
  starter?: boolean;
  shopPrice?: number;
}

export const COSMETIC_CATALOGUE: readonly CosmeticDefinition[] = [
  {
    id: "default-pink-hair",
    name: "Purple Spiky Hair",
    description: "ZenChad's original short, layered purple-magenta spikes.",
    slot: "hair",
    thumbnail: "/assets/status/generated/core/head-magenta-spiky-hair.png",
    paperDollLayer: "/assets/status/paper-doll/layers/hair/default-magenta-spikes-canonical-v3.png",
    paperDollRole: "hair",
    starter: true
  },
  {
    id: "porter-robinson-nurture-hair",
    name: "Porter Robinson Nurture Hair",
    description: "Soft centre-parted blond hair inspired by Porter's Nurture era.",
    slot: "hair",
    thumbnail: "/assets/status/generated/hair/porter-robinson-nurture-hair.png",
    paperDollLayer: "/assets/status/paper-doll/layers/hair/porter-robinson-nurture-hair-canonical-v5.png",
    paperDollRole: "hair",
    shopPrice: 20
  },
  {
    id: "noodle-dare-hair",
    name: "Noodle DARE Hair",
    description: "The deep indigo, eye-skimming DARE-era Noodle silhouette.",
    slot: "hair",
    thumbnail: "/assets/status/generated/hair/noodle-dare-hair.png",
    paperDollLayer: "/assets/status/paper-doll/layers/hair/noodle-dare-hair-canonical-v4.png",
    paperDollRole: "hair",
    shopPrice: 25
  },
  {
    id: "silver-lilac-tousled-hair",
    name: "Silver Lilac Tousle",
    description: "Tousled medium-length hair in cool silver-lilac with periwinkle shadows and icy highlights.",
    slot: "hair",
    thumbnail: "/assets/status/generated/hair/silver-lilac-tousled-hair.png",
    paperDollLayer: "/assets/status/paper-doll/layers/hair/silver-lilac-tousled-hair-canonical-v4.png",
    paperDollRole: "hair",
    shopPrice: 30
  },
  {
    id: "runner-top",
    name: "Charcoal Training Top",
    description: "The original zip-front ZenChad training shirt.",
    slot: "top",
    thumbnail: "/assets/status/generated/core/top-charcoal-training-shirt.png",
    paperDollLayer: "/assets/status/paper-doll/layers/top/charcoal-training-shirt-canonical-v3.png",
    paperDollRole: "top",
    starter: true
  },
  {
    id: "cream-meditation-jacket",
    name: "Cream Meditation Jacket",
    description: "A calm cream jacket with indigo piping and a clean standing collar.",
    slot: "top",
    thumbnail: "/assets/status/generated/future/zenchad-cream-meditation-jacket.png",
    paperDollLayer: "/assets/status/paper-doll/layers/top/cream-meditation-jacket-canonical-v3.png",
    paperDollRole: "top",
    shopPrice: 65
  },
  {
    id: "fitness-watch",
    name: "Fitness Watch",
    description: "The original black training watch with a green pulse display.",
    slot: "wrist",
    thumbnail: "/assets/status/generated/effects/fitness-smartwatch.png",
    paperDollLayer: "/assets/status/paper-doll/layers/wrist/black-fitness-watch-canonical-v3.png",
    paperDollRole: "wrist",
    starter: true
  },
  {
    id: "hana-candy-bracelets",
    name: "Hana Candy Bracelets",
    description: "Three joyful rave kandi bracelets in Hana's candy colours.",
    slot: "wrist",
    thumbnail: "/assets/status/generated/wrist/hana-candy-bracelets.png",
    paperDollLayer: "/assets/status/paper-doll/layers/wrist/hana-candy-bracelets-canonical-v3.png",
    paperDollRole: "wrist",
    shopPrice: 35
  },
  {
    id: "katie-run-friendship-bracelet",
    name: "Katie Run Bracelet",
    description: "A hand-braided red, blue, teal and yellow friendship bracelet made for runs together.",
    slot: "wrist",
    thumbnail: "/assets/status/generated/wrist/katie-run-friendship-bracelet.png",
    paperDollLayer: "/assets/status/paper-doll/layers/wrist/katie-run-friendship-bracelet-canonical-v3.png",
    paperDollRole: "wrist",
    starter: true
  },
  {
    id: "runner-shorts",
    name: "Charcoal Training Shorts",
    description: "The original lightweight ZenChad training shorts.",
    slot: "legs",
    thumbnail: "/assets/status/generated/core/legs-charcoal-training-shorts.png",
    paperDollLayer: "/assets/status/paper-doll/layers/legs/charcoal-training-shorts-canonical-v3.png",
    paperDollRole: "legs",
    starter: true
  },
  {
    id: "cat-shorts",
    name: "Cat Shorts",
    description: "A playful cat-print shorts layer for the bottom slot.",
    slot: "legs",
    thumbnail: "/assets/status/generated/legs/cat-shorts.png",
    paperDollLayer: "/assets/status/paper-doll/layers/legs/cat-shorts-canonical-v3.png",
    paperDollRole: "legs",
    shopPrice: 25
  },
  {
    id: "red-trainers",
    name: "Black & Magenta Trainers",
    description: "The original rugged black trainers with magenta accents.",
    slot: "shoes",
    thumbnail: "/assets/status/generated/core/shoes-black-magenta-trainers.png",
    paperDollLayer: "/assets/status/paper-doll/layers/shoes/black-magenta-trainers-canonical-v3.png",
    paperDollRole: "shoes",
    starter: true
  },
  {
    id: "3d-printed-running-shoes",
    name: "3D Printed Running Shoes",
    description: "Your 3D-printed running shoes, ready for the next run.",
    slot: "shoes",
    thumbnail: "/assets/status/generated/shoes/3d-printed-running-shoes.png",
    paperDollLayer: "/assets/status/paper-doll/layers/shoes/3d-printed-running-shoes-canonical-v3.png",
    paperDollRole: "shoes",
    shopPrice: 30
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

export function unequipCosmetic(data: AppData, cosmeticId: string): AppData {
  const item = cosmeticById(cosmeticId);
  if (!item || data.progression.equippedCosmetics[item.slot] !== cosmeticId) return data;
  return {
    ...data,
    progression: {
      ...data.progression,
      equippedCosmetics: {
        ...data.progression.equippedCosmetics,
        [item.slot]: DEFAULT_EQUIPPED_COSMETICS[item.slot]
      }
    }
  };
}
