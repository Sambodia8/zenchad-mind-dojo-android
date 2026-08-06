const iconFiles: Record<string, string> = {
  metta: "metta.svg",
  binaural: "binaural_beats.svg",
  pratyahara: "pratyahara.svg",
  nsdr: "nsdr.svg",
  "yoga-nidra": "nsdr.svg",
  "diaphragmatic-breathing": "pratyahara.svg",
  frisson: "frisson.svg",
  "sound-awareness": "binaural_beats.svg",
  "focused-attention": "trataka.svg",
  ego: "ego_dissolution.svg",
  "tripp-vr": "tripp_vr.svg",
  ajna: "ajna_chakra.svg",
  "urge-surfing": "urge_surfing.svg",
  grounding: "acceptance.svg",
  acceptance: "acceptance.svg",
  trataka: "trataka.svg",
  "maloka-vr": "maloka_vr.svg"
};

export const meditationIconPath = (meditationId: string) => {
  const file = iconFiles[meditationId];
  return file ? `assets/meditation-icons/${file}` : null;
};

interface Props {
  meditationId: string;
  className?: string;
  alt?: string;
}

export default function MeditationIcon({ meditationId, className = "", alt = "" }: Props) {
  const path = meditationIconPath(meditationId);
  if (!path) {
    return <span className={`meditation-icon-fallback ${className}`} aria-hidden="true">◌</span>;
  }
  return (
    <img
      className={`meditation-icon ${className}`}
      src={path}
      alt={alt}
    />
  );
}
