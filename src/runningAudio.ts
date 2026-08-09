import { Capacitor, registerPlugin } from "@capacitor/core";

interface RunningAudioPolicy {
  storyAudioRequestsFocus: boolean;
  navigationRequestsTransientFocus: boolean;
  navigationFocusHeld: boolean;
}

interface RunningAudioPlugin {
  beginNavigationFocus(): Promise<{ granted: boolean }>;
  endNavigationFocus(): Promise<void>;
  getPolicy(): Promise<RunningAudioPolicy>;
}

const RunningAudio = registerPlugin<RunningAudioPlugin>("RunningAudio");

export async function beginRunningNavigationAudioFocus() {
  if (Capacitor.getPlatform() !== "android") return { granted: false };
  return RunningAudio.beginNavigationFocus();
}

export async function endRunningNavigationAudioFocus() {
  if (Capacitor.getPlatform() !== "android") return;
  await RunningAudio.endNavigationFocus();
}

export async function withRunningNavigationAudioFocus<T>(playInstruction: () => Promise<T>) {
  await beginRunningNavigationAudioFocus().catch(() => ({ granted: false }));
  try {
    return await playInstruction();
  } finally {
    await endRunningNavigationAudioFocus().catch(() => {});
  }
}

export async function getRunningAudioPolicy(): Promise<RunningAudioPolicy> {
  if (Capacitor.getPlatform() !== "android") {
    return {
      storyAudioRequestsFocus: false,
      navigationRequestsTransientFocus: false,
      navigationFocusHeld: false
    };
  }
  return RunningAudio.getPolicy();
}
