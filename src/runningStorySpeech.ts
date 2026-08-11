import { Capacitor, registerPlugin } from "@capacitor/core";

interface RunningStorySpeechPlugin {
  speak(options: { text: string }): Promise<void>;
  stop(): Promise<void>;
}

const RunningStorySpeech = registerPlugin<RunningStorySpeechPlugin>("RunningStorySpeech");

function browserSpeak(text: string) {
  if (!("speechSynthesis" in window)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export async function speakStoryLine(text: string) {
  const clean = text.trim();
  if (!clean) return;
  if (Capacitor.getPlatform() === "android") {
    await RunningStorySpeech.speak({ text: clean }).catch(() => {});
    return;
  }
  await browserSpeak(clean);
}

export async function stopStorySpeech() {
  if (Capacitor.getPlatform() === "android") {
    await RunningStorySpeech.stop().catch(() => {});
  } else if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
