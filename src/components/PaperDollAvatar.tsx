import { useId } from "react";
import { cosmeticById } from "../cosmetics";
import type { EquippedCosmetics } from "../types";

// All coordinates are source pixels on the current 1086 x 1448 character.
// Clip in the source layer's space, then fit to the current body's landmarks.
export const PAPER_DOLL_FITS: Record<string, { clip: string; transform?: string }> = {
  "porter-robinson-nurture-hair": {
    clip: "M460 150H628V337H589L594 289 594 267 586 253 580 233 570 210H518L507 229 501 245 491 262 493 290 499 337H460Z",
    // Fit visible strands, not the transparent canvas; keep the part at the forehead.
    transform: "translate(544 210) scale(1.28) translate(-544 -210)"
  },
  "noodle-dare-hair": {
    clip: "M431 130H665V345H610L609 278 604 248 594 245 579 256 555 269 518 281 493 291 480 310 480 345H431Z"
  },
  "silver-lilac-tousled-hair": {
    clip: "M430 125H664V319H607L602 292 600 267 589 250 574 225 566 207 545 211 528 231 515 254 496 277 486 301 483 319H430Z"
  },
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
        {layers.map(({ id }) => PAPER_DOLL_FITS[id] && (
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
            clipPath={PAPER_DOLL_FITS[id] ? `url(#${prefix}-${id})` : undefined} />
        </g>
      ))}
    </svg>
  );
}
