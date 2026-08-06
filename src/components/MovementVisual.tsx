import { useId } from "react";
import type { Movement } from "../types";

interface Props {
  movement: Movement;
  mirrored?: boolean;
  compact?: boolean;
}

export default function MovementVisual({ movement, mirrored = false, compact = false }: Props) {
  const gradientId = useId().replace(/:/g, "");
  const tone = movement.sensationKind === "stretch" ? "#ef5d68" : "#3b82f6";

  return (
    <div
      className={`movement-visual ${compact ? "compact" : ""} ${mirrored ? "mirrored" : ""}`}
      data-sensation={movement.sensationKind}
    >
      {movement.image ? (
        <img src={movement.image} alt={`Visual guide for ${movement.name}`} />
      ) : (
        <div className="movement-image-placeholder" aria-label={`Image to be added for ${movement.name}`} />
      )}
      <svg
        className="movement-heatmap"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={gradientId}>
            <stop offset="0%" stopColor={tone} stopOpacity="0.78" />
            <stop offset="55%" stopColor={tone} stopOpacity="0.48" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </radialGradient>
        </defs>
        {movement.bodyAreas.map((bodyArea, index) => (
          <ellipse
            key={`${bodyArea.x}-${bodyArea.y}-${index}`}
            cx={bodyArea.x}
            cy={bodyArea.y}
            rx={bodyArea.rx}
            ry={bodyArea.ry}
            fill={`url(#${gradientId})`}
            transform={
              bodyArea.rotate
                ? `rotate(${bodyArea.rotate} ${bodyArea.x} ${bodyArea.y})`
                : undefined
            }
          />
        ))}
      </svg>
    </div>
  );
}
