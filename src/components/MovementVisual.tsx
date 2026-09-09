import { useEffect, useState } from "react";
import type { Movement } from "../types";

interface Props {
  movement: Movement;
  mirrored?: boolean;
  compact?: boolean;
  /** Enable only in the active movement stage. Pausing is separate so its frame is retained. */
  playback?: boolean;
  paused?: boolean;
  reducedMotion?: boolean;
}

export default function MovementVisual({
  movement, mirrored = false, compact = false, playback = false,
  paused = false, reducedMotion = false
}: Props) {
  const frames = movement.visualFrames;
  const frameKey = JSON.stringify([movement.id, frames]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [frame, setFrame] = useState({ key: frameKey, index: 0 });
  const [systemReducedMotion, setSystemReducedMotion] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setFrame({ key: frameKey, index: 0 });
  }, [frameKey, playback, mirrored]);

  const canAnimate = playback && !compact && !reducedMotion && !systemReducedMotion && (frames?.length ?? 0) > 1;
  useEffect(() => {
    if (!canAnimate || !frames || failedKey === frameKey || loadedKey === frameKey) return;
    let cancelled = false;
    const images = [...new Set(frames)].map((src) => {
      const image = new Image();
      const ready = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Movement frame unavailable"));
      });
      image.src = src;
      return { image, ready };
    });
    Promise.all(images.map(({ ready }) => ready)).then(() => {
      if (!cancelled) setLoadedKey(frameKey);
    }).catch(() => {
      if (!cancelled) setFailedKey(frameKey);
    });
    return () => {
      cancelled = true;
      images.forEach(({ image }) => { image.onload = null; image.onerror = null; });
    };
  }, [canAnimate, frameKey, frames, failedKey, loadedKey]);

  const showFrames = canAnimate && loadedKey === frameKey && failedKey !== frameKey;
  useEffect(() => {
    if (!showFrames || paused || !frames) return;
    const timer = window.setInterval(() => setFrame((current) => ({
      key: frameKey,
      index: ((current.key === frameKey ? current.index : 0) + 1) % frames.length
    })), 700);
    return () => window.clearInterval(timer);
  }, [showFrames, paused, frameKey, frames]);

  const source = showFrames && frames ? frames[frame.key === frameKey ? frame.index : 0] : movement.image;
  return (
    <div
      className={`movement-visual ${compact ? "compact" : ""} ${mirrored ? "mirrored" : ""}`}
    >
      {source ? (
        <img
          src={source}
          alt={`Visual guide for ${movement.name}`}
          decoding="async"
          onError={() => { if (showFrames) setFailedKey(frameKey); }}
        />
      ) : (
        <div className="movement-image-placeholder" aria-label={`Image to be added for ${movement.name}`} />
      )}
    </div>
  );
}
