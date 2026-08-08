import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { KeepAwake } from "@capacitor-community/keep-awake";

const GENTLE_REMINDER_ID = 4101;
const TIMER_NOTIFICATION_IDS = Array.from({ length: 20 }, (_, index) => 5200 + index);
const BIKE_RIDE_NOTIFICATION_ID = 6101;

export interface TimerNotificationBoundary {
  at: Date;
  title: string;
  body: string;
}

export interface NativeActionResult {
  ok: boolean;
  reason?: string;
}

export interface WhisperJournalStatus {
  modelInstalled: boolean;
  modelBytes: number;
  recording: boolean;
  recordingBytes: number;
  modelInstallPath: string;
  systemInfo: string;
  downloadId: number;
  downloadStatus: "none" | "pending" | "running" | "paused" | "successful" | "failed";
  downloadBytes: number;
  downloadTotalBytes: number;
  downloadError: number;
}

export interface WhisperTranscription {
  transcript: string;
  elapsedMs: number;
  threads: number;
}

export interface QwenJournalStatus {
  modelInstalled: boolean;
  modelBytes: number;
  modelInstallPath: string;
  downloadId: number;
  downloadStatus: "none" | "pending" | "running" | "paused" | "successful" | "failed";
  downloadBytes: number;
  downloadTotalBytes: number;
  downloadError: number;
}

export interface QwenJournalGeneration {
  output: string;
  elapsedMs: number;
  modelBytes: number;
}

interface WhisperJournalNativePlugin {
  getStatus(): Promise<WhisperJournalStatus>;
  downloadModel(): Promise<WhisperJournalStatus>;
  cancelDownload(): Promise<WhisperJournalStatus>;
  startRecording(): Promise<{ ok: boolean; sampleRate: number }>;
  stopRecording(): Promise<{ ok: boolean; durationMs: number; audioBytes: number }>;
  transcribe(): Promise<WhisperTranscription>;
  deleteRecording(): Promise<{ deleted: boolean }>;
}

const WhisperJournal = registerPlugin<WhisperJournalNativePlugin>("WhisperJournal");

interface QwenJournalNativePlugin {
  getStatus(): Promise<QwenJournalStatus>;
  downloadModel(): Promise<QwenJournalStatus>;
  cancelDownload(): Promise<QwenJournalStatus>;
  generate(options: { prompt: string; maxTokens?: number }): Promise<QwenJournalGeneration>;
}

const QwenJournal = registerPlugin<QwenJournalNativePlugin>("QwenJournal");

export const isNativeAndroid = () => Capacitor.getPlatform() === "android";

export async function getWhisperJournalStatus(): Promise<WhisperJournalStatus> {
  if (!isNativeAndroid()) {
    throw new Error("Offline Whisper recording is available in the installed Android app.");
  }
  return WhisperJournal.getStatus();
}

export async function downloadWhisperJournalModel(): Promise<WhisperJournalStatus> {
  if (!isNativeAndroid()) {
    throw new Error("The offline Whisper model is available in the installed Android app.");
  }
  return WhisperJournal.downloadModel();
}

export async function cancelWhisperJournalDownload(): Promise<WhisperJournalStatus> {
  if (!isNativeAndroid()) {
    throw new Error("The offline Whisper model is available in the installed Android app.");
  }
  return WhisperJournal.cancelDownload();
}

export async function startWhisperJournalRecording() {
  if (!isNativeAndroid()) {
    throw new Error("Offline Whisper recording is available in the installed Android app.");
  }
  return WhisperJournal.startRecording();
}

export async function stopWhisperJournalRecording() {
  return WhisperJournal.stopRecording();
}

export async function transcribeWhisperJournalRecording() {
  return WhisperJournal.transcribe();
}

export async function deleteWhisperJournalRecording() {
  return WhisperJournal.deleteRecording();
}

export async function getQwenJournalStatus(): Promise<QwenJournalStatus> {
  if (!isNativeAndroid()) {
    throw new Error("The offline Qwen journal organiser is available in the installed Android app.");
  }
  return QwenJournal.getStatus();
}

export async function downloadQwenJournalModel(): Promise<QwenJournalStatus> {
  if (!isNativeAndroid()) {
    throw new Error("The offline Qwen journal organiser is available in the installed Android app.");
  }
  return QwenJournal.downloadModel();
}

export async function cancelQwenJournalDownload(): Promise<QwenJournalStatus> {
  if (!isNativeAndroid()) {
    throw new Error("The offline Qwen journal organiser is available in the installed Android app.");
  }
  return QwenJournal.cancelDownload();
}

export async function generateQwenJournalDraft(prompt: string, maxTokens = 700): Promise<QwenJournalGeneration> {
  if (!isNativeAndroid()) {
    throw new Error("The offline Qwen journal organiser is available in the installed Android app.");
  }
  return QwenJournal.generate({ prompt, maxTokens });
}

async function ensureGentleChannel() {
  if (!isNativeAndroid()) return;
  await LocalNotifications.createChannel({
    id: "gentle-reminders",
    name: "Gentle reminders",
    description: "Optional, low-pressure reminders chosen by you.",
    importance: 2,
    vibration: false,
    lights: false
  });
}

async function ensureBikeQuestChannel() {
  if (!isNativeAndroid()) return;
  await LocalNotifications.createChannel({
    id: "bike-quest",
    name: "Bike Quest",
    description: "Keeps the active Bike Quest ride easy to find while you use other apps.",
    importance: 3,
    vibration: false,
    lights: false
  });
}

export async function requestNotificationPermission(): Promise<NativeActionResult> {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, reason: "Notifications are available in the installed Android app." };
  }

  try {
    let permission = await LocalNotifications.checkPermissions();
    if (permission.display !== "granted") {
      permission = await LocalNotifications.requestPermissions();
    }
    return permission.display === "granted"
      ? { ok: true }
      : { ok: false, reason: "Android notification permission was not granted." };
  } catch {
    return { ok: false, reason: "Android could not enable notifications." };
  }
}

export async function scheduleGentleReminder(time: string): Promise<NativeActionResult> {
  const permission = await requestNotificationPermission();
  if (!permission.ok) return permission;

  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return { ok: false, reason: "Choose a valid reminder time." };
  }

  try {
    await ensureGentleChannel();
    await LocalNotifications.cancel({ notifications: [{ id: GENTLE_REMINDER_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: GENTLE_REMINDER_ID,
          title: "A little space is here",
          body: "Meditate if it would help. There is nothing to protect or catch up on.",
          channelId: "gentle-reminders",
          schedule: {
            on: { hour, minute },
            allowWhileIdle: true
          },
          extra: { kind: "gentle-reminder" }
        }
      ]
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "Android could not schedule that reminder." };
  }
}

export async function cancelGentleReminder() {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id: GENTLE_REMINDER_ID }] });
}

export async function scheduleTimerNotifications(boundaries: TimerNotificationBoundary[]) {
  if (!Capacitor.isNativePlatform()) return;
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return;

  await cancelTimerNotifications();
  const futureBoundaries = boundaries
    .filter((boundary) => boundary.at.getTime() > Date.now() + 500)
    .slice(0, TIMER_NOTIFICATION_IDS.length);
  if (!futureBoundaries.length) return;

  await LocalNotifications.schedule({
    notifications: futureBoundaries.map((boundary, index) => ({
      id: TIMER_NOTIFICATION_IDS[index],
      title: boundary.title,
      body: boundary.body,
      schedule: { at: boundary.at, allowWhileIdle: true },
      extra: { kind: "timer-boundary" }
    }))
  });
}

export async function cancelTimerNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({
    notifications: TIMER_NOTIFICATION_IDS.map((id) => ({ id }))
  });
}

export async function showBikeRideRunningNotification(): Promise<NativeActionResult> {
  if (!Capacitor.isNativePlatform()) return { ok: true };
  const permission = await requestNotificationPermission();
  if (!permission.ok) return permission;

  try {
    await ensureBikeQuestChannel();
    await LocalNotifications.cancel({ notifications: [{ id: BIKE_RIDE_NOTIFICATION_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: BIKE_RIDE_NOTIFICATION_ID,
          title: "Bike Quest is running 🚲",
          body: "Your ride timer is still running. Open Zenchad when you finish pedalling.",
          channelId: "bike-quest",
          ongoing: true,
          autoCancel: false,
          extra: { kind: "bike-ride-running" }
        }
      ]
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "Android could not pin the Bike Quest notification." };
  }
}

export async function cancelBikeRideNotification() {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id: BIKE_RIDE_NOTIFICATION_ID }] });
}

export async function keepScreenAwake() {
  try {
    await KeepAwake.keepAwake();
  } catch {
    // The timer remains deadline-based even when keep-awake is unsupported.
  }
}

export async function allowScreenSleep() {
  try {
    await KeepAwake.allowSleep();
  } catch {
    // No action is needed when the platform has no keep-awake implementation.
  }
}
