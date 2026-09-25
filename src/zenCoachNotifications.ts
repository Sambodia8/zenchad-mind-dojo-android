import { LocalNotifications } from "@capacitor/local-notifications";
import { App as CapacitorApp } from "@capacitor/app";
import { isNativeAndroid, requestNotificationPermission, type NativeActionResult } from "./native";
import { getDailyZenCoachRecommendation, loadAcceptedZenCoachPlan } from "./zenCoach";
import { loadRunSession } from "./running";
import { loadBikeQuestState } from "./bikeQuest";

const SETTINGS_KEY = "zenchad_zen_coach_notifications_v1";
const NOTIFICATION_ID = 6301;
const CHANNEL_ID = "zen-coach";
const DAY = 86_400_000;

export interface ZenCoachNotificationSettings {
  enabled: boolean;
  time: string;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
}

export interface ZenCoachNotificationResult extends NativeActionResult {
  nextReminderAt?: number | null;
}

const defaults: ZenCoachNotificationSettings = {
  enabled: false,
  time: "18:00",
  quietHoursEnabled: true,
  quietStart: "21:00",
  quietEnd: "08:00"
};

function minuteOfDay(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

export function loadZenCoachNotificationSettings(): ZenCoachNotificationSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null") as Partial<ZenCoachNotificationSettings> | null;
    if (!stored) return { ...defaults };
    return {
      enabled: stored.enabled === true,
      time: typeof stored.time === "string" && minuteOfDay(stored.time) !== null ? stored.time : defaults.time,
      quietHoursEnabled: stored.quietHoursEnabled !== false,
      quietStart: typeof stored.quietStart === "string" && minuteOfDay(stored.quietStart) !== null ? stored.quietStart : defaults.quietStart,
      quietEnd: typeof stored.quietEnd === "string" && minuteOfDay(stored.quietEnd) !== null ? stored.quietEnd : defaults.quietEnd
    };
  } catch {
    return { ...defaults };
  }
}

function saveSettings(settings: ZenCoachNotificationSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function inQuietHours(at: Date, settings: ZenCoachNotificationSettings): boolean {
  if (!settings.quietHoursEnabled) return false;
  const start = minuteOfDay(settings.quietStart)!;
  const end = minuteOfDay(settings.quietEnd)!;
  const minute = at.getHours() * 60 + at.getMinutes();
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

function nextAllowedTime(at: Date, settings: ZenCoachNotificationSettings): Date {
  if (!inQuietHours(at, settings)) return at;
  const end = minuteOfDay(settings.quietEnd)!;
  const next = new Date(at);
  next.setHours(Math.floor(end / 60), end % 60, 0, 0);
  if (next.getTime() <= at.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

/** One dated reminder, based only on the locally recorded workout history. */
export function nextZenCoachReminderAt(settings: ZenCoachNotificationSettings, now = Date.now()): number | null {
  if (!settings.enabled) return null;
  if (loadAcceptedZenCoachPlan()) return null;
  const run = loadRunSession();
  if (run && run.stage !== "complete") return null;
  const bike = loadBikeQuestState();
  if (bike && bike.step !== "complete") return null;
  const minutes = minuteOfDay(settings.time);
  if (minutes === null || (settings.quietHoursEnabled && settings.quietStart === settings.quietEnd)) return null;
  for (let offset = 0; offset <= 8; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    const allowed = nextAllowedTime(candidate, settings);
    const at = allowed.getTime();
    if (at <= now + 1000 || at > now + 9 * DAY) continue;
    const recommendation = getDailyZenCoachRecommendation({ now: at });
    if (recommendation.due && recommendation.primary.activity !== "rest" && recommendation.weekly.remaining > 0) return at;
  }
  return null;
}

let pending: Promise<ZenCoachNotificationResult> = Promise.resolve({ ok: true });

function serialize(action: () => Promise<ZenCoachNotificationResult>): Promise<ZenCoachNotificationResult> {
  pending = pending.then(action, action);
  return pending;
}

async function refresh(forceBackground = false): Promise<ZenCoachNotificationResult> {
  if (!isNativeAndroid()) return { ok: true, nextReminderAt: null };
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
    const settings = loadZenCoachNotificationSettings();
    if (!settings.enabled) return { ok: true, nextReminderAt: null };
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== "granted") return { ok: false, reason: "Android notification permission is not granted.", nextReminderAt: null };
    const at = nextZenCoachReminderAt(settings);
    if (at === null) return { ok: true, nextReminderAt: null };
    // Keep the Home card as the sole prompt while the app is in the foreground.
    if (!forceBackground && typeof document !== "undefined" && document.visibilityState === "visible") return { ok: true, nextReminderAt: at };
    const recommendation = getDailyZenCoachRecommendation({ now: at });
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Zen Coach",
      description: "Optional suggestions based on completed workouts.",
      importance: 2,
      vibration: false,
      lights: false
    });
    await LocalNotifications.schedule({ notifications: [{
      id: NOTIFICATION_ID,
      title: "Today's adventure is ready",
      body: `${recommendation.primary.title} · around ${recommendation.primary.minutes} min. Open ZenChad when it suits you.`,
      channelId: CHANNEL_ID,
      schedule: { at: new Date(at), allowWhileIdle: true },
      extra: { kind: "zen-coach-reminder" }
    }] });
    return { ok: true, nextReminderAt: at };
  } catch {
    return { ok: false, reason: "Android could not update the Zen Coach reminder." };
  }
}

/** Call after workouts, coach decisions, profile edits, imports, and app resume. Never asks for permission. */
export function refreshZenCoachNotification(forceBackground = false): Promise<ZenCoachNotificationResult> {
  return serialize(() => refresh(forceBackground));
}

export function cancelZenCoachNotification(): Promise<ZenCoachNotificationResult> {
  return serialize(async () => {
    if (!isNativeAndroid()) return { ok: true, nextReminderAt: null };
    try {
      await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
      return { ok: true, nextReminderAt: null };
    } catch {
      return { ok: false, reason: "Android could not clear the Zen Coach reminder." };
    }
  });
}

/** Schedule only while backgrounded; cancel on return to avoid foreground duplicates. */
export function startZenCoachNotificationRuntime(): void {
  if (!isNativeAndroid()) return;
  void cancelZenCoachNotification();
  void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
    if (isActive) void cancelZenCoachNotification();
    else void refreshZenCoachNotification(true);
  });
}

/** Use only from an explicit settings toggle. A denied request leaves reminders off. */
export function setZenCoachNotificationEnabled(enabled: boolean): Promise<ZenCoachNotificationResult> {
  return serialize(async () => {
    if (enabled) {
      const permission = await requestNotificationPermission();
      if (!permission.ok) return permission;
    }
    const settings = { ...loadZenCoachNotificationSettings(), enabled };
    saveSettings(settings);
    const result = await refresh();
    if (enabled && !result.ok) saveSettings({ ...settings, enabled: false });
    return result;
  });
}

/** Set time or quiet hours; enabled state is controlled only by the explicit toggle. */
export function updateZenCoachNotificationSettings(change: Partial<Omit<ZenCoachNotificationSettings, "enabled">>): Promise<ZenCoachNotificationResult> {
  return serialize(async () => {
    const settings = { ...loadZenCoachNotificationSettings(), ...change };
    if ([settings.time, settings.quietStart, settings.quietEnd].some((value) => minuteOfDay(value) === null) ||
        (settings.quietHoursEnabled && settings.quietStart === settings.quietEnd)) {
      return { ok: false, reason: "Choose valid reminder and quiet hours." };
    }
    saveSettings(settings);
    return refresh();
  });
}
