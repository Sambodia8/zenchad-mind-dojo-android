import { useState, type Dispatch, type SetStateAction } from "react";
import { Coins, ShoppingBag } from "lucide-react";
import type { AppData, Route } from "../types";
import { purchaseFailureMessage, purchaseShopItem, SHOP_CATALOGUE } from "../shop";

interface Props {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  navigate: Dispatch<SetStateAction<Route>>;
}

export default function ZenShopScreen({ data, setData }: Props) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const buy = (itemId: string) => setData((current) => {
    const result = purchaseShopItem(current, itemId);
    setFeedback(result.ok ? `${result.item.name} unlocked. Equip it from Status.` : purchaseFailureMessage(result.reason));
    window.setTimeout(() => setFeedback(null), 2200);
    return result.data;
  });

  return (
    <div className="screen-stack zen-shop-screen">
      <section className="screen-heading">
        <span className="eyebrow"><ShoppingBag size={15} /> Zen Shop</span>
        <h1>Spend your calm wisely.</h1>
        <p>Unlock cosmetics and gentle tools. New cosmetics stay unequipped until you choose them on Status.</p>
      </section>
      <div className="shop-balance"><Coins size={18} /><strong>{data.zenPoints} ZP</strong><span>available</span></div>
      <section className="shop-catalogue" aria-label="Shop catalogue">
        {SHOP_CATALOGUE.map((item) => {
          const owned = data.shopInventory[item.id] ?? 0;
          const uniqueOwned = item.kind === "unique" && owned > 0;
          return (
            <article className="shop-item card" key={item.id}>
              <div className={`shop-item-icon ${item.image ? "has-image" : ""}`} aria-hidden="true">
                {item.image ? <img src={item.image} alt="" /> : item.icon}
              </div>
              <div>
                <span className="eyebrow">{item.category}</span>
                <h2>{item.name}</h2>
                <p>{item.description}</p>
                <small>{item.kind === "unique" ? (uniqueOwned ? "Owned" : "Permanent unlock") : `Owned: ${owned}`}</small>
              </div>
              <button className="button primary" onClick={() => buy(item.id)} disabled={uniqueOwned || data.zenPoints < item.price}>
                {uniqueOwned ? "Owned" : <><Coins size={15} /> {item.price} ZP</>}
              </button>
            </article>
          );
        })}
      </section>
      {feedback ? <p className="shop-feedback" role="status">{feedback}</p> : null}
    </div>
  );
}
