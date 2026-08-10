import { Capacitor, registerPlugin } from "@capacitor/core";
import { withRunningNavigationAudioFocus } from "./runningAudio";

interface RunningSpeechPlugin {
  speak(options: { text: string }): Promise<void>;
  stop(): Promise<void>;
}

const RunningSpeech = registerPlugin<RunningSpeechPlugin>("RunningSpeech");

function browserSpeak(text: string) {
  if (!("speechSynthesis" in window)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 1.02;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

export async function speakRunningNavigation(text: string) {
  const clean = text.trim();
  if (!clean) return;
  await withRunningNavigationAudioFocus(async () => {
    if (Capacitor.getPlatform() === "android") {
      await RunningSpeech.speak({ text: clean });
      return;
    }
    await browserSpeak(clean);
  });
}

export async function stopRunningNavigationSpeech() {
  if (Capacitor.getPlatform() === "android") {
    await RunningSpeech.stop().catch(() => {});
  } else if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
