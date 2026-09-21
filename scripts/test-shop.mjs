import assert from "node:assert/strict";
globalThis.localStorage = { value: null, getItem() { return this.value; }, setItem(_key, value) { this.value = value; } };
const { defaultData, loadData } = await import("../src/storage.ts");
const { purchaseShopItem } = await import("../src/shop.ts");
const { cosmeticById, equipCosmetic, isCosmeticOwned, unequipCosmetic } = await import("../src/cosmetics.ts");
const poor = purchaseShopItem({ ...defaultData, zenPoints: 24 }, "streak-freeze");
assert.equal(poor.ok, false); assert.equal(poor.reason, "insufficient-balance");
const bought = purchaseShopItem({ ...defaultData, zenPoints: 25 }, "streak-freeze", "2026-08-18T20:00:00.000Z");
assert.equal(bought.ok, true);
if (bought.ok) { assert.equal(bought.data.zenPoints, 0); assert.equal(bought.data.shopInventory["streak-freeze"], 1); assert.equal(bought.data.shopPurchaseHistory.length, 1); assert.equal(purchaseShopItem({ ...bought.data, zenPoints: 25 }, "streak-freeze").ok, true); }
assert.equal(isCosmeticOwned(defaultData, "default-pink-hair"), true);
assert.equal(defaultData.progression.equippedCosmetics.hair, "default-pink-hair");
assert.equal(cosmeticById("default-pink-hair")?.shopPrice, undefined);
assert.equal(isCosmeticOwned(defaultData, "porter-robinson-nurture-hair"), false);
const lockedEquip = equipCosmetic(defaultData, "porter-robinson-nurture-hair");
assert.equal(lockedEquip.progression.equippedCosmetics.hair, "default-pink-hair");
const boughtHair = purchaseShopItem({ ...defaultData, zenPoints: 20 }, "porter-robinson-nurture-hair", "2026-09-02T12:00:00.000Z");
assert.equal(boughtHair.ok, true);
if (boughtHair.ok) {
  assert.equal(boughtHair.data.zenPoints, 0);
  assert.equal(boughtHair.data.progression.equippedCosmetics.hair, "default-pink-hair");
  assert.equal(purchaseShopItem({ ...boughtHair.data, zenPoints: 45 }, "porter-robinson-nurture-hair").ok, false);
  const equippedHair = equipCosmetic(boughtHair.data, "porter-robinson-nurture-hair");
  assert.equal(equippedHair.progression.equippedCosmetics.hair, "porter-robinson-nurture-hair");
}
const silverLilac = cosmeticById("silver-lilac-tousled-hair");
assert.equal(silverLilac?.slot, "hair");
assert.equal(silverLilac?.paperDollRole, "hair");
assert.equal(silverLilac?.paperDollLayer, "/assets/status/paper-doll/layers/hair/silver-lilac-tousled-hair-canonical-v3.png");
const boughtSilverLilac = purchaseShopItem({ ...defaultData, zenPoints: 30 }, "silver-lilac-tousled-hair", "2026-09-02T12:05:00.000Z");
assert.equal(boughtSilverLilac.ok, true);
if (boughtSilverLilac.ok) {
  assert.equal(boughtSilverLilac.data.zenPoints, 0);
  assert.equal(equipCosmetic(boughtSilverLilac.data, "silver-lilac-tousled-hair").progression.equippedCosmetics.hair, "silver-lilac-tousled-hair");
}
const runningShoes = cosmeticById("3d-printed-running-shoes");
assert.equal(runningShoes?.slot, "shoes");
assert.equal(runningShoes?.paperDollRole, "shoes");
assert.equal(runningShoes?.thumbnail, "/assets/status/generated/shoes/3d-printed-running-shoes.png");
assert.equal(runningShoes?.paperDollLayer, "/assets/status/paper-doll/layers/shoes/3d-printed-running-shoes-canonical-v3.png");
const boughtRunningShoes = purchaseShopItem({ ...defaultData, zenPoints: 30 }, "3d-printed-running-shoes", "2026-09-02T12:10:00.000Z");
assert.equal(boughtRunningShoes.ok, true);
if (boughtRunningShoes.ok) {
  const equipped = equipCosmetic(boughtRunningShoes.data, "3d-printed-running-shoes");
  assert.equal(equipped.progression.equippedCosmetics.shoes, "3d-printed-running-shoes");
  assert.equal(unequipCosmetic(equipped, "3d-printed-running-shoes").progression.equippedCosmetics.shoes, "red-trainers");
}
const catShorts = cosmeticById("cat-shorts");
assert.equal(catShorts?.slot, "legs");
assert.equal(catShorts?.paperDollRole, "legs");
assert.equal(catShorts?.thumbnail, "/assets/status/generated/legs/cat-shorts.png");
assert.equal(catShorts?.paperDollLayer, "/assets/status/paper-doll/layers/legs/cat-shorts-canonical-v3.png");
const boughtCatShorts = purchaseShopItem({ ...defaultData, zenPoints: 25 }, "cat-shorts", "2026-09-02T12:15:00.000Z");
assert.equal(boughtCatShorts.ok, true);
if (boughtCatShorts.ok) {
  const equipped = equipCosmetic(boughtCatShorts.data, "cat-shorts");
  assert.equal(equipped.progression.equippedCosmetics.legs, "cat-shorts");
  assert.equal(unequipCosmetic(equipped, "cat-shorts").progression.equippedCosmetics.legs, "runner-shorts");
}
localStorage.setItem("zenchad_app_data_v1", JSON.stringify({ ...defaultData, zenPoints: 10 }));
const migrated = loadData(); assert.deepEqual(migrated.shopInventory, {}); assert.deepEqual(migrated.shopPurchaseHistory, []);
const legacyProgression = { ...defaultData.progression, equippedCosmetics: { head: "noodle-dare-hair", top: "runner-top", wrist: "fitness-watch", legs: "runner-shorts", shoes: "red-trainers", aura: "indigo-flow" } };
localStorage.setItem("zenchad_app_data_v1", JSON.stringify({ ...defaultData, progression: legacyProgression }));
assert.equal(loadData().progression.equippedCosmetics.hair, "noodle-dare-hair");
console.log("Shop tests passed");
