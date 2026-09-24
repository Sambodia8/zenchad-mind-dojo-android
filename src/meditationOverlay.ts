import { Capacitor, registerPlugin } from "@capacitor/core";

export const hasMeditationOverlay = Capacitor.getPlatform() === "android";
export const MeditationOverlay = registerPlugin<{
  permission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<void>;
  open(options: { url: string; deadline: number }): Promise<void>;
  hide(): Promise<void>;
}>("MeditationOverlay");

// Published by the creator at https://www.musicmindmagic.com/.
export const BINAURAL_PLAYLISTS = [
  { name: "Binaural Beats · MusicMindMagic", url: "https://www.youtube.com/playlist?list=PLGA9OBtRMioAtzVIVeKqWXH4lywIA7qZk" },
  { name: "40 Hz Focus · MusicMindMagic", url: "https://www.youtube.com/playlist?list=PLGA9OBtRMioA0i-e9TqOagZxgXAmyVLDZ" }
];
