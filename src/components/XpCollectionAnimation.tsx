import { useEffect, useRef, useState } from "react";
import { playUiSfx } from "../uiSfx";

interface Props {
  amount: number;
  active: boolean;
  reducedMotion: boolean;
  soundsEnabled: boolean;
  onComplete?: () => void;
}

const MAX_ORBS = 18;
const MIN_ORBS = 6;

const seededValue = (amount: number, index: number, salt: number) => {
  const value = Math.sin(amount * 12.9898 + index * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
};

export default function XpCollectionAnimation({
  amount,
  active,
  reducedMotion,
  soundsEnabled,
  onComplete
}: Props) {
  const orbCount = amount > 0
    ? Math.min(MAX_ORBS, Math.max(MIN_ORBS, Math.round(amount / 5)))
    : 0;
  const orbRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const counterRef = useRef<HTMLSpanElement | null>(null);
  const playedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active || amount <= 0 || finished) return;

    const timeouts: number[] = [];
    const animations: Animation[] = [];
    let xpTarget: HTMLElement | null = null;

    const finishAnimation = () => {
      xpTarget?.classList.remove("xp-target-collecting");
      setFinished(true);
      onCompleteRef.current?.();
    };

    const startTimer = window.setTimeout(() => {
      if (playedRef.current) return;
      playedRef.current = true;

      const source = document.querySelector<HTMLElement>("[data-xp-source]");
      xpTarget = document.querySelector<HTMLElement>("[data-xp-target]");
      const sourceRect = source?.getBoundingClientRect();
      const targetRect = xpTarget?.getBoundingClientRect();
      const startX = sourceRect ? sourceRect.left + sourceRect.width / 2 : window.innerWidth / 2;
      const startY = sourceRect ? sourceRect.top + sourceRect.height / 2 : window.innerHeight * 0.56;
      const targetX = targetRect ? targetRect.left + targetRect.width / 2 : window.innerWidth - 74;
      const targetY = targetRect ? targetRect.top + targetRect.height / 2 : 54;

      if (counterRef.current) {
        counterRef.current.style.left = `${startX}px`;
        counterRef.current.style.top = `${startY}px`;
      }

      if (reducedMotion) {
        if (counterRef.current) counterRef.current.textContent = "+0 XP";
        xpTarget?.classList.add("xp-target-collecting");
        if (soundsEnabled) playUiSfx("xpGain");
        timeouts.push(window.setTimeout(finishAnimation, 280));
        return;
      }

      let finalArrival = 0;
      let absorbedOrbs = 0;
      orbRefs.current.forEach((orb, index) => {
        if (!orb) return;
        const scatterX = (seededValue(amount, index, 1) - 0.5) * 116;
        const scatterY = 42 + seededValue(amount, index, 2) * 94;
        const curveX = (seededValue(amount, index, 3) - 0.5) * 96;
        const startOffsetX = (seededValue(amount, index, 4) - 0.5) * 20;
        const startOffsetY = (seededValue(amount, index, 5) - 0.5) * 14;
        const delay = index * 82 + Math.round(seededValue(amount, index, 6) * 45);
        const duration = 820 + Math.round(seededValue(amount, index, 7) * 260);
        const arrival = delay + duration;
        finalArrival = Math.max(finalArrival, arrival);

        orb.style.left = `${startX}px`;
        orb.style.top = `${startY}px`;
        const animation = orb.animate(
          [
            {
              opacity: 0,
              transform: `translate3d(${startOffsetX}px, ${startOffsetY}px, 0) scale(.35)`
            },
            {
              opacity: 1,
              offset: 0.16,
              transform: `translate3d(${startOffsetX + scatterX}px, ${startOffsetY - scatterY}px, 0) scale(1)`
            },
            {
              opacity: 1,
              offset: 0.72,
              transform: `translate3d(${(targetX - startX) * 0.7 + curveX}px, ${(targetY - startY) * 0.7 - 34}px, 0) scale(.82)`
            },
            {
              opacity: 0,
              transform: `translate3d(${targetX - startX}px, ${targetY - startY}px, 0) scale(.18)`
            }
          ],
          {
            delay,
            duration,
            easing: "cubic-bezier(.22,.76,.28,1)",
            fill: "both"
          }
        );
        animations.push(animation);

        timeouts.push(window.setTimeout(() => {
          absorbedOrbs += 1;
          const remainingXp = amount - Math.round((amount * absorbedOrbs) / orbCount);
          if (counterRef.current) counterRef.current.textContent = `+${Math.max(0, remainingXp)} XP`;
          xpTarget?.classList.add("xp-target-collecting");
          if (soundsEnabled) playUiSfx("xpGain", { overlap: true });
        }, Math.max(0, arrival - 70)));
      });

      timeouts.push(window.setTimeout(finishAnimation, finalArrival + 180));
    }, 0);
    timeouts.push(startTimer);

    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
      animations.forEach((animation) => animation.cancel());
      xpTarget?.classList.remove("xp-target-collecting");
    };
  }, [active, amount, finished, reducedMotion, soundsEnabled]);

  if (!active || amount <= 0 || finished) return null;

  return (
    <div className="xp-collection-overlay">
      <span ref={counterRef} className="xp-collection-counter" aria-hidden="true">+{amount} XP</span>
      <div className="xp-collection-orbs" aria-hidden="true">
        {Array.from({ length: orbCount }, (_, index) => (
          <span
            key={index}
            ref={(node) => { orbRefs.current[index] = node; }}
            className="xp-collection-orb"
          />
        ))}
      </div>
      <span className="sr-only" role="status">{amount} experience points collected</span>
    </div>
  );
}
