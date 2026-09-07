import type { AppData, ShopPurchase } from "./types";
import { COSMETIC_CATALOGUE } from "./cosmetics";

export type ShopItemKind = "consumable" | "unique";
export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  kind: ShopItemKind;
  category: "utility" | "cosmetic";
  icon?: string;
  image?: string;
}

const COSMETIC_SHOP_ITEMS: ShopItem[] = COSMETIC_CATALOGUE
  .filter((item) => item.shopPrice !== undefined)
  .map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.shopPrice as number,
    kind: "unique",
    category: "cosmetic",
    image: item.thumbnail
  }));

export const SHOP_CATALOGUE: readonly ShopItem[] = [
  {
    id: "streak-freeze",
    name: "Streak Freeze",
    description: "Automatically protects your meditation streak after one missed day. No activation needed.",
    price: 25,
    kind: "consumable",
    category: "utility",
    icon: "❄️"
  },
  ...COSMETIC_SHOP_ITEMS
];
export type PurchaseFailure = "unknown-item" | "insufficient-balance" | "already-owned";
export type PurchaseResult = { ok: true; data: AppData; item: ShopItem } | { ok: false; data: AppData; reason: PurchaseFailure };
export function shopItem(itemId: string) { return SHOP_CATALOGUE.find((item) => item.id === itemId); }

export function purchaseShopItem(data: AppData, itemId: string, purchasedAt = new Date().toISOString()): PurchaseResult {
  const item = shopItem(itemId);
  if (!item) return { ok: false, data, reason: "unknown-item" };
  const owned = Math.max(0, Math.floor(data.shopInventory[item.id] ?? 0));
  if (item.kind === "unique" && owned > 0) return { ok: false, data, reason: "already-owned" };
  if (data.zenPoints < item.price) return { ok: false, data, reason: "insufficient-balance" };
  const purchase: ShopPurchase = { itemId: item.id, quantity: 1, purchasedAt, price: item.price };
  return { ok: true, item, data: { ...data, zenPoints: data.zenPoints - item.price, shopInventory: { ...data.shopInventory, [item.id]: owned + 1 }, shopPurchaseHistory: [...data.shopPurchaseHistory, purchase] } };
}

export function purchaseFailureMessage(reason: PurchaseFailure) {
  if (reason === "already-owned") return "You already have this unique item.";
  if (reason === "insufficient-balance") return "Earn a few more ZenPoints first.";
  return "That item is not available right now.";
}
