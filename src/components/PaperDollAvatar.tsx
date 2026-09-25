import { useId } from "react";
import { cosmeticById } from "../cosmetics";
import type { EquippedCosmetics } from "../types";

// All coordinates are source pixels on the current 1086 x 1448 character.
// Clip in the source layer's space, then fit to the current body's landmarks.
export const PAPER_DOLL_FITS: Record<string, { clip?: string; transform?: string }> = {
  // These three styles use one replacement-head group: the exact canonical face
  // and neck, plus a hairstyle fitted to that identity rather than the bald base.
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

const REPLACEMENT_HEAD_HAIRS = new Set([
  "porter-robinson-nurture-hair",
  "noodle-dare-hair",
  "silver-lilac-tousled-hair"
]);

// Source-coordinate silhouette of the original character's face, ears and neck.
// The alternate hairstyle is drawn over this, so every selection retains the
// first head's actual eyes, nose, mouth, beard, jaw, ears and neck join.
const CANONICAL_HEAD_CLIP = [
  "M500 268C518 264 568 264 586 268C590 280 590 296 586 309",
  "C580 329 570 340 558 348C548 354 538 354 528 348",
  "C514 341 504 329 500 309C496 294 496 280 500 268Z"
].join("");

const COMPLETE_HEAD_CLIP = [
  "M543 150C497 150 473 187 472 244L462 265C455 274 458 304 469 316",
  "L483 315C492 335 504 346 519 354C534 362 552 362 568 354",
  "C583 346 595 335 603 315L617 316C628 304 631 274 624 265",
  "L614 244C613 187 589 150 543 150Z"
].join("");

const ORIGINAL_ITEMS = ["runner-shorts", "red-trainers", "runner-top", "fitness-watch", "default-pink-hair"];

export default function PaperDollAvatar({ equipped, portrait = false }: { equipped: EquippedCosmetics; portrait?: boolean }) {
  const prefix = useId().replace(/:/g, "");
  const ids = [equipped.legs, equipped.shoes, equipped.top, equipped.wrist, equipped.hair];
  const layers = ids.map((id) => ({ id, definition: cosmeticById(id) }));
  const replacementHead = REPLACEMENT_HEAD_HAIRS.has(equipped.hair);
  const original = ids.every((id, index) => id === ORIGINAL_ITEMS[index]);
  const valid = layers.every(({ definition }) => definition?.paperDollLayer);
  return (
    <svg className={portrait ? "status-face-portrait" : "status-avatar-stack"}
      viewBox={portrait ? "420 112 240 246" : "0 0 1086 1448"}
      preserveAspectRatio={portrait ? "xMidYMid meet" : "xMidYMid slice"}
      role="img" aria-label={portrait ? "Sam's equipped hairstyle portrait" : "Sam, ZenChad avatar"}
      data-paper-doll-items={ids.join(",")}>
      <defs>
        {replacementHead ? (
          <>
            <clipPath id={`${prefix}-complete-head`} clipPathUnits="userSpaceOnUse">
              <path d={COMPLETE_HEAD_CLIP} />
            </clipPath>
            <clipPath id={`${prefix}-canonical-head`} clipPathUnits="userSpaceOnUse">
              <path d={CANONICAL_HEAD_CLIP} />
            </clipPath>
          </>
        ) : null}
        {layers.map(({ id }) => PAPER_DOLL_FITS[id]?.clip && (
          <clipPath key={id} id={`${prefix}-${id}`} clipPathUnits="userSpaceOnUse">
            <path d={PAPER_DOLL_FITS[id].clip} />
          </clipPath>
        ))}
      </defs>
      <image data-paper-doll-base="true" href={original || !valid
        ? "/assets/status/zen-chad-status.png"
        : "/assets/status/paper-doll/base/zenchad-canonical-underlayer-v3.png"} width="1086" height="1448" />
      {!original && valid && layers.filter(({ id }) => !(replacementHead && id === equipped.hair)).map(({ id, definition }) => (
        <g key={id} transform={PAPER_DOLL_FITS[id]?.transform} data-paper-doll-layer={definition!.paperDollRole}>
          <image href={definition!.paperDollLayer} width="1086" height="1448"
            clipPath={PAPER_DOLL_FITS[id]?.clip ? `url(#${prefix}-${id})` : undefined} />
        </g>
      ))}
      {!original && valid && replacementHead ? (
        <g data-paper-doll-layer="head-and-hair">
          <image href="/assets/status/paper-doll/base/zenchad-canonical-underlayer-v3.png"
            width="1086" height="1448" clipPath={`url(#${prefix}-complete-head)`} />
          <image href="/assets/status/zen-chad-status.png" width="1086" height="1448"
            clipPath={`url(#${prefix}-canonical-head)`} />
          <g transform={PAPER_DOLL_FITS[equipped.hair]?.transform}>
            <image href={cosmeticById(equipped.hair)!.paperDollLayer} width="1086" height="1448" />
          </g>
        </g>
      ) : null}
    </svg>
  );
}
