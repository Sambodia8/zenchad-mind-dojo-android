import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Image, X } from "lucide-react";
import {
  getRunPhotoDisplayDataUrl,
  getRunPhotoThumbnailDataUrl,
  type RunPhoto
} from "../runningPhotos";

interface Props {
  runId: string;
  photos: RunPhoto[];
  initialPhotoId: string;
  onClose: () => void;
}

interface GalleryImage {
  dataUrl: string | null;
  source: "original" | "thumbnail" | "missing";
}

async function loadGalleryImage(runId: string, photo: RunPhoto): Promise<GalleryImage> {
  const display = await getRunPhotoDisplayDataUrl(runId, photo.id);
  if (display.dataUrl) return { dataUrl: display.dataUrl, source: "original" };
  const thumbnail = photo.hasAppCopy ? await getRunPhotoThumbnailDataUrl(runId, photo.id) : null;
  return thumbnail
    ? { dataUrl: thumbnail, source: "thumbnail" }
    : { dataUrl: null, source: "missing" };
}

export default function RunPhotoGallery({ runId, photos, initialPhotoId, onClose }: Props) {
  const orderedPhotos = useMemo(
    () => [...photos].sort((left, right) => left.capturedAt - right.capturedAt),
    [photos]
  );
  const [index, setIndex] = useState(() => Math.max(0, orderedPhotos.findIndex((photo) => photo.id === initialPhotoId)));
  const [images, setImages] = useState<Record<string, GalleryImage>>({});
  const pointerStartX = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const photo = orderedPhotos[index];

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!photo) return;
    let active = true;
    const candidates = [orderedPhotos[index - 1], photo, orderedPhotos[index + 1]].filter(
      (candidate): candidate is RunPhoto => Boolean(candidate && !images[candidate.id])
    );
    if (!candidates.length) return;
    void Promise.all(candidates.map(async (candidate) => [candidate.id, await loadGalleryImage(runId, candidate)] as const))
      .then((loaded) => {
        if (!active) return;
        setImages((current) => ({ ...current, ...Object.fromEntries(loaded) }));
      });
    return () => { active = false; };
  }, [images, index, orderedPhotos, photo, runId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
      if (event.key === "ArrowRight") setIndex((current) => Math.min(orderedPhotos.length - 1, current + 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, orderedPhotos.length]);

  if (!photo) return null;
  const loaded = images[photo.id];
  const label = photo.caption?.trim() || `Run photo ${index + 1}`;

  const finishSwipe = (clientX: number) => {
    const start = pointerStartX.current;
    pointerStartX.current = null;
    if (start === null || Math.abs(clientX - start) < 50) return;
    setIndex((current) => clientX < start
      ? Math.min(orderedPhotos.length - 1, current + 1)
      : Math.max(0, current - 1));
  };

  return (
    <div
      ref={dialogRef}
      className="run-photo-gallery"
      role="dialog"
      aria-modal="true"
      aria-label={`Photos from this run. ${index + 1} of ${orderedPhotos.length}`}
      tabIndex={-1}
    >
      <div className="run-photo-gallery-toolbar">
        <span>{index + 1} / {orderedPhotos.length}</span>
        <button type="button" onClick={onClose} aria-label="Close run photo gallery"><X /></button>
      </div>
      <div
        className="run-photo-gallery-stage"
        onPointerDown={(event) => { pointerStartX.current = event.clientX; }}
        onPointerUp={(event) => finishSwipe(event.clientX)}
        onPointerCancel={() => { pointerStartX.current = null; }}
      >
        {loaded?.dataUrl ? <img src={loaded.dataUrl} alt={label} /> : loaded ? <div className="run-photo-gallery-missing"><Image /><strong>Photo unavailable</strong><span>The original and ZenChad thumbnail are no longer available.</span></div> : <div className="run-photo-gallery-loading" role="status">Loading photo…</div>}
      </div>
      <button type="button" className="run-photo-gallery-arrow previous" disabled={index === 0} onClick={() => setIndex((current) => Math.max(0, current - 1))} aria-label="Previous run photo"><ChevronLeft /></button>
      <button type="button" className="run-photo-gallery-arrow next" disabled={index === orderedPhotos.length - 1} onClick={() => setIndex((current) => Math.min(orderedPhotos.length - 1, current + 1))} aria-label="Next run photo"><ChevronRight /></button>
      <div className="run-photo-gallery-caption">
        <strong>{label}</strong>
        <span>{new Date(photo.capturedAt).toLocaleString()}</span>
        {loaded?.source === "thumbnail" ? <small>Original unavailable · showing ZenChad’s saved thumbnail</small> : null}
      </div>
    </div>
  );
}
