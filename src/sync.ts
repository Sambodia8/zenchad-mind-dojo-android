import type { AppData, AppPreferences, JournalEntry, MoodEntry, EmotionalToolAttempt, YogaClass } from "./types";
import { defaultData, loadData, migrateProgressionData, saveData } from "./storage";
import { statLevelForXp } from "./progression";

export const SYNC_FILE_NAME = "zenchad-sync.json";
export const SYNC_ANDROID_PATH = "/storage/emulated/0/ZenChad/zenchad-sync.json";
export const SYNC_PC_PATH = "D:\\My Drive\\ZenChad\\zenchad-sync.json";
export const SYNC_DEVICE_ID_KEY = "zenchad_sync_device_id_v1";
export const SYNC_TOMBSTONES_KEY = "zenchad_sync_tombstones_v1";
export const SYNC_LAST_STATUS_KEY = "zenchad_sync_last_status_v1";
export const SYNC_BACKUP_PREFIX = "zenchad_sync_backup_";
export const SYNC_CONFLICT_PREFIX = "zenchad_sync_conflict_";
export const SYNC_SCHEMA_VERSION = 1 as const;
export const SYNC_APP_VERSION = "1.6";

export interface SyncTombstone {
  collection: string;
  id: string;
  deletedAt: string;
}

export interface ZenChadSyncEnvelope {
  format: "zenchad-sync";
  schemaVersion: typeof SYNC_SCHEMA_VERSION;
  appVersion: string;
  sourceDeviceId: string;
  exportedAt: string;
  data: AppData;
  durableStores: Record<string, unknown>;
  tombstones: SyncTombstone[];
}

export interface SyncStatus {
  configured: boolean;
  lastAction: "export" | "import" | "merge" | "error" | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  sourceDeviceId: string;
}

export interface SyncMergeResult {
  envelope: ZenChadSyncEnvelope;
  changed: boolean;
  conflicts: string[];
}

export interface SyncStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

const TRANSIENT_KEYS = new Set([
  "zenchad_active_timer_v1",
  "zenchad_running_session_v1",
  "zenchad_running_route_v1",
  "zenchad_running_route_state_v1",
  "zenchad_running_story_runtime_v1",
  "zenchad_running_ai_director_v1",
  "zenchad_bike_quest_v1",
  "zenchad_historical_journal_v1",
  "zenchad_sync_device_id_v1",
  "zenchad_sync_tombstones_v1",
  "zenchad_sync_last_status_v1"
]);

function runtimeStorage(): SyncStorageLike | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `zenchad-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getSyncDeviceId(storage = runtimeStorage()): string {
  if (!storage) return "serverless-device";
  const existing = storage.getItem(SYNC_DEVICE_ID_KEY);
  if (existing) return existing;
  const created = newId();
  storage.setItem(SYNC_DEVICE_ID_KEY, created);
  return created;
}

export function loadSyncTombstones(storage = runtimeStorage()): SyncTombstone[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(SYNC_TOMBSTONES_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is SyncTombstone => Boolean(
        item && typeof item.collection === "string" && typeof item.id === "string" && typeof item.deletedAt === "string"
      ))
      : [];
  } catch {
    return [];
  }
}

export function recordSyncTombstones(tombstones: SyncTombstone[], storage = runtimeStorage()) {
  if (!storage || !tombstones.length) return;
  const current = loadSyncTombstones(storage);
  const byKey = new Map(current.map((item) => [`${item.collection}:${item.id}`, item]));
  for (const item of tombstones) byKey.set(`${item.collection}:${item.id}`, item);
  storage.setItem(SYNC_TOMBSTONES_KEY, JSON.stringify([...byKey.values()].slice(-1000)));
}

function parseStoredValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function captureDurableStores(storage = runtimeStorage()): Record<string, unknown> {
  if (!storage) return {};
  const stores: Record<string, unknown> = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith("zenchad_") || TRANSIENT_KEYS.has(key) || key.startsWith("zenchad_last_") || key.startsWith("zenchad_sync_")) continue;
    const raw = storage.getItem(key);
    if (raw !== null) stores[key] = parseStoredValue(raw);
  }
  return stores;
}

export function captureSyncEnvelope(data = loadData(), storage = runtimeStorage(), now = new Date()): ZenChadSyncEnvelope {
  return {
    format: "zenchad-sync",
    schemaVersion: SYNC_SCHEMA_VERSION,
    appVersion: SYNC_APP_VERSION,
    sourceDeviceId: getSyncDeviceId(storage),
    exportedAt: now.toISOString(),
    data,
    durableStores: captureDurableStores(storage),
    tombstones: loadSyncTombstones(storage)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function itemId(value: unknown): string | null {
  if (!isRecord(value)) return null;
  for (const key of ["id", "runId", "toolId"]) {
    if (typeof value[key] === "string") return value[key];
  }
  return null;
}

function newestTimestamp(value: unknown): number {
  if (!isRecord(value)) return 0;
  for (const key of ["updatedAt", "createdAt", "completedAt", "endedAt", "importedAt", "unlockedAt"]) {
    const candidate = value[key];
    const timestamp = typeof candidate === "number" ? candidate : typeof candidate === "string" ? Date.parse(candidate) : NaN;
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return 0;
}

function mergeIdentifiedArrays<T>(local: T[], incoming: T[], collection: string, tombstones: SyncTombstone[], conflicts: string[]): T[] {
  const merged = new Map<string, T>();
  const fallback: T[] = [];
  for (const item of [...local, ...incoming]) {
    const id = itemId(item);
    if (!id) {
      fallback.push(item);
      continue;
    }
    const existing = merged.get(id);
    if (!existing) {
      merged.set(id, item);
      continue;
    }
    if (JSON.stringify(existing) === JSON.stringify(item)) continue;
    const winner = newestTimestamp(item) >= newestTimestamp(existing) ? item : existing;
    merged.set(id, winner);
    conflicts.push(`${collection}:${id}`);
  }
  const deleted = new Set(tombstones.filter((item) => item.collection === collection).map((item) => item.id));
  return [...fallback, ...[...merged.entries()].filter(([id]) => !deleted.has(id)).map(([, item]) => item)];
}

function mergePreferences(local: AppPreferences, incoming: AppPreferences, incomingIsNewer: boolean) {
  return incomingIsNewer ? { ...local, ...incoming } : { ...incoming, ...local };
}

function mergeStats(local: AppData["stats"], incoming: AppData["stats"]): AppData["stats"] {
  const weeklySeconds = { ...local.weeklySeconds };
  for (const [day, seconds] of Object.entries(incoming.weeklySeconds ?? {})) {
    weeklySeconds[day] = Math.max(weeklySeconds[day] ?? 0, seconds);
  }
  return {
    ...local,
    xp: Math.max(local.xp, incoming.xp),
    level: Math.max(local.level, incoming.level),
    streak: Math.max(local.streak, incoming.streak),
    totalSeconds: Math.max(local.totalSeconds, incoming.totalSeconds),
    sessionsCompleted: Math.max(local.sessionsCompleted, incoming.sessionsCompleted),
    lastSessionDate: [local.lastSessionDate, incoming.lastSessionDate].filter(Boolean).sort().at(-1) ?? null,
    weeklySeconds,
    lastSeenLevel: Math.max(local.lastSeenLevel, incoming.lastSeenLevel),
    rouletteSpins: Math.max(local.rouletteSpins, incoming.rouletteSpins),
    yogaSessions: Math.max(local.yogaSessions, incoming.yogaSessions)
  };
}

function mergeProgression(local: AppData["progression"], incoming: AppData["progression"], incomingIsNewer: boolean) {
  const skillXp = { ...local.skillXp };
  const skillLevels = { ...local.skillLevels };
  for (const key of Object.keys(skillXp)) {
    skillXp[key as keyof typeof skillXp] = Math.max(skillXp[key as keyof typeof skillXp], incoming.skillXp[key as keyof typeof incoming.skillXp] ?? 0);
    skillLevels[key as keyof typeof skillLevels] = statLevelForXp(key as keyof typeof skillXp, skillXp[key as keyof typeof skillXp]);
  }
  return {
    ...local,
    version: 2 as const,
    flowLevel: Math.max(local.flowLevel, incoming.flowLevel),
    flowXp: Math.max(local.flowXp, incoming.flowXp),
    flowTotalXp: Math.max(local.flowTotalXp, incoming.flowTotalXp),
    flowLastPracticeDate: [local.flowLastPracticeDate, incoming.flowLastPracticeDate].filter(Boolean).sort().at(-1) ?? null,
    flowConsecutiveDays: Math.max(local.flowConsecutiveDays, incoming.flowConsecutiveDays),
    skillXp,
    skillLevels,
    equippedCosmetics: incomingIsNewer ? incoming.equippedCosmetics : local.equippedCosmetics,
    flowForm: incomingIsNewer ? incoming.flowForm : local.flowForm
  };
}

function mergeData(local: AppData, incoming: AppData, incomingIsNewer: boolean, tombstones: SyncTombstone[], conflicts: string[]): AppData {
  const mergeArray = <T>(collection: string, a: T[], b: T[]) => mergeIdentifiedArrays(a ?? [], b ?? [], collection, tombstones, conflicts);
  const localMystery = local.mysteryChallenge;
  const incomingMystery = incoming.mysteryChallenge;
  const mystery = incomingIsNewer ? {
    ...localMystery,
    ...incomingMystery,
    completedRuns: Math.max(localMystery.completedRuns, incomingMystery.completedRuns),
    lastCompletedAt: [localMystery.lastCompletedAt, incomingMystery.lastCompletedAt].filter(Boolean).sort().at(-1) ?? null,
    lastRunMatchedSecret: localMystery.lastRunMatchedSecret || incomingMystery.lastRunMatchedSecret,
    clueVisible: localMystery.clueVisible || incomingMystery.clueVisible,
    bonusUnlocked: localMystery.bonusUnlocked || incomingMystery.bonusUnlocked
  } : {
    ...incomingMystery,
    ...localMystery,
    completedRuns: Math.max(localMystery.completedRuns, incomingMystery.completedRuns),
    lastCompletedAt: [localMystery.lastCompletedAt, incomingMystery.lastCompletedAt].filter(Boolean).sort().at(-1) ?? null,
    lastRunMatchedSecret: localMystery.lastRunMatchedSecret || incomingMystery.lastRunMatchedSecret,
    clueVisible: localMystery.clueVisible || incomingMystery.clueVisible,
    bonusUnlocked: localMystery.bonusUnlocked || incomingMystery.bonusUnlocked
  };
  return {
    ...local,
    stats: mergeStats(local.stats, incoming.stats),
    zenPoints: incomingIsNewer ? incoming.zenPoints : local.zenPoints,
    lifetimeZenPoints: Math.max(local.lifetimeZenPoints ?? 0, incoming.lifetimeZenPoints ?? 0),
    moods: mergeArray<MoodEntry>("moods", local.moods, incoming.moods),
    journal: mergeArray<JournalEntry>("journal", local.journal, incoming.journal),
    emotionalTools: mergeArray("emotionalTools", local.emotionalTools, incoming.emotionalTools),
    emotionalToolAttempts: mergeArray<EmotionalToolAttempt>("emotionalToolAttempts", local.emotionalToolAttempts, incoming.emotionalToolAttempts),
    preferences: mergePreferences(local.preferences, incoming.preferences, incomingIsNewer),
    moodScaleVersion: Math.max(local.moodScaleVersion, incoming.moodScaleVersion),
    customYogaClasses: mergeArray<YogaClass>("customYogaClasses", local.customYogaClasses, incoming.customYogaClasses),
    downloadedSoundscapes: [...new Set([...(local.downloadedSoundscapes ?? []), ...(incoming.downloadedSoundscapes ?? [])])],
    mysteryChallenge: mystery,
    progression: mergeProgression(local.progression, incoming.progression, incomingIsNewer)
  };
}

function mergeDurableStores(local: Record<string, unknown>, incoming: Record<string, unknown>, incomingIsNewer: boolean, conflicts: string[]) {
  const result: Record<string, unknown> = { ...local };
  for (const [key, incomingValue] of Object.entries(incoming)) {
    const localValue = result[key];
    if (Array.isArray(localValue) && Array.isArray(incomingValue)) {
      const ids = new Map<string, unknown>();
      const unkeyed: unknown[] = [];
      for (const item of [...localValue, ...incomingValue]) {
        const id = itemId(item);
        if (!id) unkeyed.push(item);
        else ids.set(id, ids.has(id) && newestTimestamp(ids.get(id)) > newestTimestamp(item) ? ids.get(id) : item);
      }
      result[key] = [...unkeyed, ...ids.values()];
      continue;
    }
    if (JSON.stringify(localValue) !== JSON.stringify(incomingValue) && localValue !== undefined) conflicts.push(`store:${key}`);
    result[key] = incomingIsNewer || localValue === undefined ? incomingValue : localValue;
  }
  return result;
}

export function mergeSyncEnvelopes(local: ZenChadSyncEnvelope, incoming: ZenChadSyncEnvelope): SyncMergeResult {
  if (incoming.format !== "zenchad-sync" || incoming.schemaVersion !== SYNC_SCHEMA_VERSION) {
    throw new Error("Unsupported ZenChad sync file format.");
  }
  const conflicts: string[] = [];
  const localTime = Date.parse(local.exportedAt) || 0;
  const incomingTime = Date.parse(incoming.exportedAt) || 0;
  const incomingIsNewer = incomingTime >= localTime;
  const tombstoneMap = new Map<string, SyncTombstone>();
  for (const item of [...local.tombstones, ...incoming.tombstones]) {
    const key = `${item.collection}:${item.id}`;
    const current = tombstoneMap.get(key);
    if (!current || Date.parse(item.deletedAt) >= Date.parse(current.deletedAt)) tombstoneMap.set(key, item);
  }
  const tombstones = [...tombstoneMap.values()];
  const merged: ZenChadSyncEnvelope = {
    format: "zenchad-sync",
    schemaVersion: SYNC_SCHEMA_VERSION,
    appVersion: incomingIsNewer ? incoming.appVersion : local.appVersion,
    sourceDeviceId: incomingIsNewer ? incoming.sourceDeviceId : local.sourceDeviceId,
    exportedAt: incomingIsNewer ? incoming.exportedAt : local.exportedAt,
    data: mergeData(local.data, incoming.data, incomingIsNewer, tombstones, conflicts),
    durableStores: mergeDurableStores(local.durableStores, incoming.durableStores, incomingIsNewer, conflicts),
    tombstones
  };
  return {
    envelope: merged,
    changed: JSON.stringify(merged) !== JSON.stringify(local),
    conflicts
  };
}

export function parseSyncEnvelope(raw: string): ZenChadSyncEnvelope {
  const parsed = JSON.parse(raw) as Partial<ZenChadSyncEnvelope>;
  if (parsed.format !== "zenchad-sync" || parsed.schemaVersion !== SYNC_SCHEMA_VERSION || !parsed.data) {
    throw new Error("This is not a supported ZenChad sync file.");
  }
  return {
    format: "zenchad-sync",
    schemaVersion: SYNC_SCHEMA_VERSION,
    appVersion: typeof parsed.appVersion === "string" ? parsed.appVersion : "unknown",
    sourceDeviceId: typeof parsed.sourceDeviceId === "string" ? parsed.sourceDeviceId : "unknown",
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date(0).toISOString(),
    data: {
      ...defaultData,
      ...parsed.data,
      progression: migrateProgressionData(parsed.data.progression)
    },
    durableStores: isRecord(parsed.durableStores) ? parsed.durableStores : {},
    tombstones: Array.isArray(parsed.tombstones) ? parsed.tombstones : []
  };
}

export function applySyncEnvelope(envelope: ZenChadSyncEnvelope, storage = runtimeStorage()): AppData {
  const current = loadData();
  const local = captureSyncEnvelope(current, storage);
  const mergeResult = mergeSyncEnvelopes(local, envelope);
  const merged = mergeResult.envelope;
  if (storage) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    storage.setItem(`${SYNC_BACKUP_PREFIX}${stamp}`, JSON.stringify({ savedAt: new Date().toISOString(), envelope: local }));
    if (mergeResult.conflicts.length) {
      storage.setItem(`${SYNC_CONFLICT_PREFIX}${stamp}`, JSON.stringify({ savedAt: new Date().toISOString(), conflicts: mergeResult.conflicts, local, incoming: envelope }));
    }
  }
  saveData(merged.data);
  if (storage) {
    for (const [key, value] of Object.entries(merged.durableStores)) storage.setItem(key, JSON.stringify(value));
    recordSyncTombstones(merged.tombstones, storage);
    setSyncStatus({ lastAction: "import", lastSuccessAt: new Date().toISOString(), lastError: null }, storage);
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("zenchad:sync-applied"));
  return merged.data;
}

export function getSyncStatus(storage = runtimeStorage()): SyncStatus {
  const deviceId = getSyncDeviceId(storage);
  if (!storage) return { configured: false, lastAction: null, lastSuccessAt: null, lastError: null, sourceDeviceId: deviceId };
  try {
    const parsed = JSON.parse(storage.getItem(SYNC_LAST_STATUS_KEY) ?? "{}");
    return {
      configured: parsed.configured === true,
      lastAction: ["export", "import", "merge", "error"].includes(parsed.lastAction) ? parsed.lastAction : null,
      lastSuccessAt: typeof parsed.lastSuccessAt === "string" ? parsed.lastSuccessAt : null,
      lastError: typeof parsed.lastError === "string" ? parsed.lastError : null,
      sourceDeviceId: deviceId
    };
  } catch {
    return { configured: false, lastAction: null, lastSuccessAt: null, lastError: null, sourceDeviceId: deviceId };
  }
}

export function setSyncStatus(update: Partial<Omit<SyncStatus, "sourceDeviceId">>, storage = runtimeStorage()) {
  if (!storage) return;
  const current = getSyncStatus(storage);
  storage.setItem(SYNC_LAST_STATUS_KEY, JSON.stringify({ ...current, ...update, configured: update.configured ?? current.configured }));
}

export function serialiseSyncEnvelope(envelope: ZenChadSyncEnvelope) {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}
