import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { withRunningNavigationAudioFocus } from "./runningAudio";

interface RunningSpeechPlugin {
  speak(options: { text: string; voiceId?: string }): Promise<void>;
  stop(): Promise<void>;
  getVoices(): Promise<{ voices: NativeRunningSpeechVoice[] }>;
  setVoicePreference(options: { voiceId: string }): Promise<void>;
  addListener(eventName: "voicesReady", listener: () => void): Promise<PluginListenerHandle>;
}

const RunningSpeech = registerPlugin<RunningSpeechPlugin>("RunningSpeech");

export interface RunningSpeechVoice {
  id: string;
  name: string;
  lang: string;
  localeLabel?: string;
  default?: boolean;
  networkRequired?: boolean;
  installed?: boolean;
}

interface NativeRunningSpeechVoice extends RunningSpeechVoice {}

let selectedVoiceId: string | null = null;

export function setRunningSpeechVoice(voiceId: string | null) {
  selectedVoiceId = voiceId?.trim() || null;
  if (Capacitor.getPlatform() === "android") {
    void RunningSpeech.setVoicePreference({ voiceId: selectedVoiceId ?? "" }).catch(() => {});
  }
}

function voiceScore(voice: RunningSpeechVoice) {
  let score = 0;
  if (voice.installed === false) return -10_000;
  if (voice.networkRequired) score -= 2_000;
  if (voice.lang.toLowerCase().startsWith("en-gb")) score += 500;
  else if (voice.lang.toLowerCase().startsWith("en")) score += 300;
  else score += 20;
  if (voice.default) score += 40;
  return score;
}

export function preferredRunningSpeechVoice(voices: RunningSpeechVoice[]) {
  return voices
    .filter((voice) => voice.id && voice.name && voice.installed !== false)
    .sort((left, right) => voiceScore(right) - voiceScore(left))[0] ?? null;
}

export function runningSpeechVoiceDescription(voice: RunningSpeechVoice | null) {
  if (!voice) return "Local system default";
  return `${voice.name}${voice.networkRequired ? " · Internet required" : " · Offline"}`;
}

function browserVoices(): RunningSpeechVoice[] {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices().map((voice) => ({
    id: voice.voiceURI,
    name: voice.name,
    lang: voice.lang,
    localeLabel: voice.lang,
    default: voice.default,
    networkRequired: false,
    installed: true
  }));
}

export async function getRunningSpeechVoices() {
  if (Capacitor.getPlatform() === "android") {
    try {
      const result = await RunningSpeech.getVoices();
      return Array.isArray(result.voices) ? result.voices : [];
    } catch {
      return [];
    }
  }
  return browserVoices();
}

export function subscribeToRunningSpeechVoices(onChange: () => void) {
  if (Capacitor.getPlatform() === "android") {
    let handle: PluginListenerHandle | null = null;
    let removed = false;
    void RunningSpeech.addListener("voicesReady", onChange).then((next) => {
      if (removed) void next.remove();
      else handle = next;
    }).catch(() => {});
    return () => {
      removed = true;
      if (handle) void handle.remove();
    };
  }
  if (!("speechSynthesis" in window)) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", onChange);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", onChange);
}

function browserSpeak(text: string) {
  if (!("speechSynthesis" in window)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 1.02;
    const voices = browserVoices();
    const voice = voices.find((candidate) => candidate.id === selectedVoiceId)
      ?? preferredRunningSpeechVoice(voices);
    if (voice) {
      const browserVoice = window.speechSynthesis.getVoices().find((candidate) => candidate.voiceURI === voice.id);
      if (browserVoice) utterance.voice = browserVoice;
    }
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
      await RunningSpeech.speak({ text: clean, ...(selectedVoiceId ? { voiceId: selectedVoiceId } : {}) });
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
