import { Sparkles } from "lucide-react";

interface Props {
  amount: number;
  reducedMotion: boolean;
}

export default function ZenPointsRewardFeedback({ amount, reducedMotion }: Props) {
  return (
    <div className={`zen-points-feedback ${reducedMotion ? "reduced" : ""}`} role="status" aria-live="polite">
      <Sparkles size={18} aria-hidden="true" />
      <span><strong>+{amount} ZP</strong><small>ZenPoints earned</small></span>
    </div>
  );
}
