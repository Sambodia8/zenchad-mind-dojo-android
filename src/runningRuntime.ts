const RUNNING_SESSION_KEY = "zenchad_running_session_v1";

interface PersistedRunSession {
  stage?: string;
  runStartedAt?: number | null;
  runEndedAt?: number | null;
}

function loadActiveRun() {
  try {
    const raw = localStorage.getItem(RUNNING_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedRunSession;
    if (parsed.stage !== "active" || !parsed.runStartedAt || parsed.runEndedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function runningIsVisible() {
  return Boolean(document.querySelector(".running-active"));
}

function clickButtonContaining(selector: string, copy: string) {
  const control = Array.from(document.querySelectorAll<HTMLButtonElement>(selector)).find((button) =>
    button.textContent?.toLowerCase().includes(copy.toLowerCase())
  );
  control?.click();
  return Boolean(control);
}

function openRunning() {
  if (runningIsVisible()) return true;
  if (!clickButtonContaining(".bottom-nav button", "Toolkit")) return false;

  [50, 140, 300, 560].forEach((delay) => {
    window.setTimeout(() => {
      if (runningIsVisible()) return;
      clickButtonContaining(".tool-journey-card", "Running");
    }, delay);
  });
  return true;
}

let autoResumeScheduled = false;

function maybeAutoResumeActiveRun() {
  if (autoResumeScheduled || runningIsVisible() || !loadActiveRun()) return;
  autoResumeScheduled = true;

  [100, 260, 600, 1000].forEach((delay) => {
    window.setTimeout(() => {
      if (runningIsVisible() || !loadActiveRun()) return;
      openRunning();
    }, delay);
  });
}

let started = false;

export function startRunningRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;

  const observer = new MutationObserver(maybeAutoResumeActiveRun);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("pageshow", maybeAutoResumeActiveRun);
  window.addEventListener("focus", maybeAutoResumeActiveRun);
  queueMicrotask(maybeAutoResumeActiveRun);
}
