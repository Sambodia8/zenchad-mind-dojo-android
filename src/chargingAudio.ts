export type ChargingTimeWindow = "overnight" | "morning" | "afternoon" | "evening";
export type ChargingThanksBand = "low" | "mid-low" | "mid-high" | "high";

export interface ChargingVoiceClip {
  id: string;
  title: string;
  trigger: string;
  src: string;
}

export const CHARGING_TIME_AUDIO: Record<ChargingTimeWindow, ChargingVoiceClip[]> = {
  overnight: [1, 2, 3].map((variant) => ({
    id: `overnight-0${variant}`,
    title: `Overnight variation ${variant}`,
    trigger: "22:00-05:59",
    src: `assets/audio/charging/time/overnight-0${variant}.ogg`
  })),
  morning: [1, 2, 3].map((variant) => ({
    id: `morning-0${variant}`,
    title: `Morning variation ${variant}`,
    trigger: "06:00-11:59",
    src: `assets/audio/charging/time/morning-0${variant}.ogg`
  })),
  afternoon: [1, 2, 3].map((variant) => ({
    id: `afternoon-0${variant}`,
    title: `Afternoon variation ${variant}`,
    trigger: "12:00-16:59",
    src: `assets/audio/charging/time/afternoon-0${variant}.ogg`
  })),
  evening: [1, 2, 3].map((variant) => ({
    id: `evening-0${variant}`,
    title: `Evening variation ${variant}`,
    trigger: "17:00-21:59",
    src: `assets/audio/charging/time/evening-0${variant}.ogg`
  }))
};

export const CHARGING_THANKS_AUDIO: Record<ChargingThanksBand, ChargingVoiceClip> = {
  low: {
    id: "battery-low",
    title: "Relieved thanks",
    trigger: "0-15%",
    src: "assets/audio/charging/thanks/battery-low.ogg"
  },
  "mid-low": {
    id: "battery-mid-low",
    title: "Grateful top-up",
    trigger: "16-39%",
    src: "assets/audio/charging/thanks/battery-mid-low.ogg"
  },
  "mid-high": {
    id: "battery-mid-high",
    title: "Powered-up thanks",
    trigger: "40-79%",
    src: "assets/audio/charging/thanks/battery-mid-high.ogg"
  },
  high: {
    id: "battery-high",
    title: "Delighted surprise",
    trigger: "80-100%",
    src: "assets/audio/charging/thanks/battery-high.ogg"
  }
};

const LAST_CLIP_KEY = "zenchad_last_charging_voice_v1";

function chooseWithoutImmediateRepeat(clips: ChargingVoiceClip[]) {
  const lastId = localStorage.getItem(LAST_CLIP_KEY);
  const candidates = clips.filter((clip) => clip.id !== lastId);
  const selected = candidates[Math.floor(Math.random() * candidates.length)] ?? clips[0];
  if (selected) localStorage.setItem(LAST_CLIP_KEY, selected.id);
  return selected;
}

export function chargingTimeWindow(date = new Date()): ChargingTimeWindow {
  const hour = date.getHours();
  if (hour < 6 || hour >= 22) return "overnight";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function chooseChargingTimeClip(date = new Date()) {
  return chooseWithoutImmediateRepeat(CHARGING_TIME_AUDIO[chargingTimeWindow(date)]);
}

export function chargingThanksBand(batteryPercent: number): ChargingThanksBand {
  const percent = Math.min(100, Math.max(0, batteryPercent));
  if (percent <= 15) return "low";
  if (percent <= 39) return "mid-low";
  if (percent <= 79) return "mid-high";
  return "high";
}

export function chargingThanksClip(batteryPercent: number) {
  const clip = CHARGING_THANKS_AUDIO[chargingThanksBand(batteryPercent)];
  localStorage.setItem(LAST_CLIP_KEY, clip.id);
  return clip;
}
