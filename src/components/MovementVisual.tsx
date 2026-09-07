import type { Movement } from "../types";

interface Props {
  movement: Movement;
  mirrored?: boolean;
  compact?: boolean;
}

export default function MovementVisual({ movement, mirrored = false, compact = false }: Props) {
  return (
    <div
      className={`movement-visual ${compact ? "compact" : ""} ${mirrored ? "mirrored" : ""}`}
    >
      {movement.image ? (
        <img src={movement.image} alt={`Visual guide for ${movement.name}`} />
      ) : (
        <div className="movement-image-placeholder" aria-label={`Image to be added for ${movement.name}`} />
      )}
    </div>
  );
}
