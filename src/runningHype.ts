export type RunHypeStatus = "ready" | "not-needed" | "outstanding";

export interface RunHypeItem {
  id: string;
  label: string;
  importance: number;
  note: string;
  carStored: boolean;
  lastCheckedAt?: number;
  custom?: boolean;
}

export interface RunHypeChecklist {
  sessionId: string;
  statusByItem: Record<string, RunHypeStatus>;
  atTrailhead: boolean;
  homePrepDone: boolean;
  travelMinutes: number;
  woodedRoute: boolean;
  darknessBufferMinutes: number;
}

const EQUIPMENT_KEY = "zenchad_running_hype_equipment_v1";
const CHECKLIST_KEY = "zenchad_running_hype_checklist_v1";

const DEFAULT_ITEMS: RunHypeItem[] = [
  { id: "towel", label: "Sweat towel", importance: 1, note: "Personal sensory essential", carStored: false },
  { id: "keys", label: "Keys", importance: 2, note: "House and car keys", carStored: false },
  { id: "phone", label: "Phone charge", importance: 3, note: "Enough charge for GPS and the journey", carStored: false },
  { id: "shoes", label: "Running shoes", importance: 4, note: "Suitable for today's route", carStored: false },
  { id: "clothes", label: "Clothes and layers", importance: 5, note: "Weather appropriate", carStored: false },
  { id: "water", label: "Water", importance: 6, note: "Bring what feels right for this run", carStored: false },
  { id: "headphones", label: "Headphones and charge", importance: 7, note: "Optional for Just Run; keep your own music", carStored: false },
  { id: "torch", label: "Torch and charge check", importance: 8, note: "Manually confirm charged today; the app cannot read battery level", carStored: false },
  { id: "yuna-torch", label: "Yuna's torch and charge check", importance: 9, note: "Only shown when Yuna is running", carStored: false }
];

function validStatus(value: unknown): value is RunHypeStatus {
  return value === "ready" || value === "not-needed" || value === "outstanding";
}

export function loadRunHypeEquipment(): RunHypeItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(EQUIPMENT_KEY) || "null");
    if (!Array.isArray(parsed)) return DEFAULT_ITEMS.map((item) => ({ ...item }));
    const defaults = new Map(DEFAULT_ITEMS.map((item) => [item.id, item]));
    const stored: RunHypeItem[] = parsed.flatMap((value): RunHypeItem[] => {
      if (!value || typeof value !== "object" || typeof value.id !== "string" || typeof value.label !== "string") return [];
      const original = defaults.get(value.id);
      return [{
        ...(original ?? { id: value.id, label: value.label.trim().slice(0, 60), importance: 99, note: "", carStored: false, custom: true }),
        label: value.label.trim().slice(0, 60),
        importance: Number.isFinite(value.importance) ? Math.max(1, Math.floor(value.importance)) : 99,
        note: typeof value.note === "string" ? value.note.slice(0, 140) : "",
        carStored: value.carStored === true,
        ...(Number.isFinite(value.lastCheckedAt) && value.lastCheckedAt > 0 ? { lastCheckedAt: Number(value.lastCheckedAt) } : {}),
        custom: original ? undefined : true
      }];
    });
    const merged = new Map<string, RunHypeItem>(stored.map((item) => [item.id, item]));
    for (const item of DEFAULT_ITEMS) if (!merged.has(item.id)) merged.set(item.id, { ...item });
    return [...merged.values()].sort((a, b) => a.importance - b.importance || a.id.localeCompare(b.id));
  } catch {
    return DEFAULT_ITEMS.map((item) => ({ ...item }));
  }
}

export function saveRunHypeEquipment(items: RunHypeItem[]) {
  const clean = items.map((item, index) => ({
    id: item.id,
    label: item.label.trim().slice(0, 60),
    importance: index + 1,
    note: item.note.trim().slice(0, 140),
    carStored: item.carStored === true,
    lastCheckedAt: item.lastCheckedAt
  })).filter((item) => item.label.length > 0);
  localStorage.setItem(EQUIPMENT_KEY, JSON.stringify(clean));
}

export function createRunHypeChecklist(sessionId: string): RunHypeChecklist {
  const last = loadRunHypeChecklist();
  const equipment = loadRunHypeEquipment();
  const statusByItem = Object.fromEntries(equipment.map((item) => [
    item.id,
    last?.statusByItem[item.id] === "not-needed" ? "not-needed" : "outstanding"
  ])) as Record<string, RunHypeStatus>;
  return { sessionId, statusByItem, atTrailhead: false, homePrepDone: false, travelMinutes: 0, woodedRoute: false, darknessBufferMinutes: 30 };
}

export function loadRunHypeChecklist(sessionId?: string): RunHypeChecklist | null {
  try {
    const value = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || "null");
    if (!value || typeof value.sessionId !== "string" || (sessionId && value.sessionId !== sessionId)) return null;
    const statusByItem = value.statusByItem && typeof value.statusByItem === "object"
      ? Object.fromEntries(Object.entries(value.statusByItem).filter((entry): entry is [string, RunHypeStatus] => validStatus(entry[1])))
      : {};
    return {
      sessionId: value.sessionId,
      statusByItem,
      atTrailhead: value.atTrailhead === true,
      homePrepDone: value.homePrepDone === true,
      travelMinutes: Number.isFinite(value.travelMinutes) ? Math.max(0, Math.min(240, Math.round(value.travelMinutes))) : 0,
      woodedRoute: value.woodedRoute === true,
      darknessBufferMinutes: Number.isFinite(value.darknessBufferMinutes) ? Math.max(0, Math.min(90, Math.round(value.darknessBufferMinutes))) : 30
    };
  } catch {
    return null;
  }
}

export function saveRunHypeChecklist(checklist: RunHypeChecklist | null) {
  if (!checklist) localStorage.removeItem(CHECKLIST_KEY);
  else localStorage.setItem(CHECKLIST_KEY, JSON.stringify(checklist));
}

export function hypeStatusLabel(status: RunHypeStatus) {
  return status === "ready" ? "Packed / ready" : status === "not-needed" ? "Not needed" : "Outstanding";
}

/** NOAA solar equations for apparent sunset, using the device's local date and timezone. */
export function sunsetForLocation(latitude: number, longitude: number, date = new Date()): Date | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 72 || Math.abs(longitude) > 180) return null;
  const year = date.getFullYear();
  const day = Math.floor((Date.UTC(year, date.getMonth(), date.getDate()) - Date.UTC(year, 0, 0)) / 86_400_000);
  const gamma = 2 * Math.PI / (leapYear(year) ? 366 : 365) * (day - 1);
  const equationOfTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const latitudeRadians = latitude * Math.PI / 180;
  const cosineHourAngle = (Math.cos(90.833 * Math.PI / 180) / (Math.cos(latitudeRadians) * Math.cos(declination))) - Math.tan(latitudeRadians) * Math.tan(declination);
  if (cosineHourAngle < -1 || cosineHourAngle > 1) return null;
  const hourAngleDegrees = Math.acos(cosineHourAngle) * 180 / Math.PI;
  const utcMinutes = 720 - 4 * (longitude - hourAngleDegrees) - equationOfTime;
  return new Date(Date.UTC(year, date.getMonth(), date.getDate()) + utcMinutes * 60_000);
}

function leapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
