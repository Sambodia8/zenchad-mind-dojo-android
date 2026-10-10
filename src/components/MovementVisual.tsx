import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Movement } from "../types";
import "../movementAnimation.css";

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
  const atlas = movement.visualAtlas;
  const frameKey = JSON.stringify([movement.id, movement.image, frames, atlas]);
  const sources = useMemo(() => atlas ? [movement.image] : [...new Set(frames ?? [])], [frameKey]);
  const frameCount = atlas?.sequence.length ?? frames?.length ?? 0;
  const [atlasSize, setAtlasSize] = useState({ key: "", aspect: 0.6, width: 0, height: 0 });
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

  const canAnimate = playback && !compact && !reducedMotion && !systemReducedMotion && frameCount > 1;
  useEffect(() => {
    if ((!canAnimate && !atlas) || !sources.length || failedKey === frameKey || loadedKey === frameKey) return;
    let cancelled = false;
    const images = sources.map((src) => {
      const image = new Image();
      const ready = new Promise<void>((resolve, reject) => {
        image.onload = () => {
          if (!cancelled && atlas) setAtlasSize({
            key: frameKey,
            aspect: atlas.layout ? atlas.layout.width / atlas.layout.height : image.naturalWidth / atlas.columns / image.naturalHeight,
            width: image.naturalWidth,
            height: image.naturalHeight
          });
          resolve();
        };
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
  }, [canAnimate, frameKey, sources, atlas, failedKey, loadedKey]);

  const showFrames = canAnimate && loadedKey === frameKey && failedKey !== frameKey;
  useEffect(() => {
    if (!showFrames || paused) return;
    const timer = window.setInterval(() => setFrame((current) => ({
      key: frameKey,
      index: ((current.key === frameKey ? current.index : 0) + 1) % frameCount
    })), atlas?.frameMs ?? 700);
    return () => window.clearInterval(timer);
  }, [showFrames, paused, frameKey, frameCount, atlas]);

  const source = showFrames && frames ? frames[frame.key === frameKey ? frame.index : 0] : movement.image;
  const poseCell = atlas?.sequence[showFrames && frame.key === frameKey ? frame.index : 0] ?? 0;
  const aspect = atlas?.layout ? atlas.layout.width / atlas.layout.height : atlasSize.key === frameKey ? atlasSize.aspect : 0.6;
  const layout = atlas?.layout;
  const crop = layout?.frames[poseCell];
  const calibrated = Boolean(layout && crop && atlasSize.key === frameKey);
  return (
    <div
      className={`movement-visual ${atlas ? "has-atlas" : ""} ${compact ? "compact" : ""} ${mirrored ? "mirrored" : ""}`}
      data-movement-id={movement.id}
      style={atlas ? { "--frame-aspect": aspect } as CSSProperties : undefined}
    >
      {atlas ? (
        <div className="movement-pose-cell" role="img" aria-label={`Visual guide for ${movement.name}`}
          data-pose-cell={poseCell} data-animation-playing={showFrames && !paused}
          style={calibrated ? { background: layout?.background ?? "transparent" } : {
            backgroundImage: `url("${movement.image}")`, backgroundSize: `${atlas.columns * 100}% 100%`,
            backgroundPosition: `${atlas.columns > 1 ? poseCell / (atlas.columns - 1) * 100 : 0}% 0`
          }}>
          {calibrated && layout && crop ? (
            <div className="movement-atlas-crop" style={{
              left: `${(layout.anchorX - crop.anchorX) / layout.width * 100}%`,
              top: `${(layout.anchorY - crop.anchorY) / layout.height * 100}%`,
              width: `${crop.width / layout.width * 100}%`,
              height: `${crop.height / layout.height * 100}%`
            }}>
              <img src={movement.image} alt="" draggable={false} style={{
                width: `${atlasSize.width / crop.width * 100}%`,
                height: `${atlasSize.height / crop.height * 100}%`,
                left: `${-crop.x / crop.width * 100}%`,
                top: `${-crop.y / crop.height * 100}%`
              }} />
            </div>
          ) : null}
        </div>
      ) : source ? (
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
