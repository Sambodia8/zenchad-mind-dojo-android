import { useId } from "react";
import { cosmeticById } from "../cosmetics";
import type { EquippedCosmetics } from "../types";

// All coordinates are source pixels on the current 1086 x 1448 character.
// Clip in the source layer's space, then fit to the current body's landmarks.
export const PAPER_DOLL_FITS: Record<string, { clip?: string; transform?: string }> = {
  // Clean hair-only layers: fit by the forehead opening, without a face-shaped mask.
  "porter-robinson-nurture-hair": { transform: "translate(0 -22)" },
  "noodle-dare-hair": { transform: "translate(544 204) scale(0.72) translate(-552 -228)" },
  "silver-lilac-tousled-hair": { transform: "translate(544 207) scale(0.82) translate(-544 -234)" },
  "cream-meditation-jacket": {
    clip: "M300 350H496V330H590V350H780V710H300Z",
    transform: "translate(0 35)"
  },
  "hana-candy-bracelets": {
    clip: "M704 676H773V719H704Z",
    transform: "translate(-28 42)"
  },
  "katie-run-friendship-bracelet": {
    clip: "M710 691H774V710H710Z",
    transform: "translate(-29 39)"
  }
};

const ORIGINAL_ITEMS = ["runner-shorts", "red-trainers", "runner-top", "fitness-watch", "default-pink-hair"];

export default function PaperDollAvatar({ equipped, portrait = false }: { equipped: EquippedCosmetics; portrait?: boolean }) {
  const prefix = useId().replace(/:/g, "");
  const ids = [equipped.legs, equipped.shoes, equipped.top, equipped.wrist, equipped.hair];
  const layers = ids.map((id) => ({ id, definition: cosmeticById(id) }));
  const original = ids.every((id, index) => id === ORIGINAL_ITEMS[index]);
  const valid = layers.every(({ definition }) => definition?.paperDollLayer);
  return (
    <svg className={portrait ? "status-face-portrait" : "status-avatar-stack"}
      viewBox={portrait ? "420 112 240 246" : "0 0 1086 1448"}
      preserveAspectRatio={portrait ? "xMidYMid meet" : "xMidYMid slice"}
      role="img" aria-label={portrait ? "Sam's equipped hairstyle portrait" : "Sam, ZenChad avatar"}
      data-paper-doll-items={ids.join(",")}>
      <defs>
        {layers.map(({ id }) => PAPER_DOLL_FITS[id]?.clip && (
          <clipPath key={id} id={`${prefix}-${id}`} clipPathUnits="userSpaceOnUse">
            <path d={PAPER_DOLL_FITS[id].clip} />
          </clipPath>
        ))}
      </defs>
      <image data-paper-doll-base="true" href={original || !valid
        ? "/assets/status/zen-chad-status.png"
        : "/assets/status/paper-doll/base/zenchad-canonical-underlayer-v3.png"} width="1086" height="1448" />
      {!original && valid && layers.map(({ id, definition }) => (
        <g key={id} transform={PAPER_DOLL_FITS[id]?.transform} data-paper-doll-layer={definition!.paperDollRole}>
          <image href={definition!.paperDollLayer} width="1086" height="1448"
            clipPath={PAPER_DOLL_FITS[id]?.clip ? `url(#${prefix}-${id})` : undefined} />
        </g>
      ))}
    </svg>
  );
}
