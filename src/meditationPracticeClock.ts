import { PRACTICE_KEY, type PracticeState } from "./meditationPractice";
interface ClockStorage { getItem(key: string): string | null; setItem(key: string,value: string): void; removeItem(key:string): void }
interface SavedClock { state: PracticeState; accumulated: number; savedAt: number }
export function createBrowserPracticeClock(storage: ClockStorage, mono = () => performance.now(), wall = () => Date.now()) {
  let state: PracticeState | null = null;
  let accumulated = 0, anchor = mono();
  try {
    const raw = storage.getItem(PRACTICE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as SavedClock;
      if(saved.state?.id && Number.isFinite(saved.accumulated) && Number.isFinite(saved.savedAt)) {
        state = saved.state; accumulated = saved.accumulated;
        if(state.status === "running") accumulated += Math.max(0, wall()-saved.savedAt)/1000;
      }
    }
  } catch { storage.removeItem(PRACTICE_KEY); }
  const persist = () => {
    if(state) storage.setItem(PRACTICE_KEY, JSON.stringify({state,accumulated,savedAt:wall()}));
    else storage.removeItem(PRACTICE_KEY);
  };
  const getState = () => {
    if(!state) return null;
    const elapsed = accumulated + (state.status === "running" ? Math.max(0,mono()-anchor)/1000 : 0);
    state = {...state,elapsedSeconds:state.mode === "countdown" ? Math.min(elapsed,state.targetSeconds) : elapsed};
    if(state.status === "running" && state.mode === "countdown" && elapsed >= state.targetSeconds) {
      state = {...state,status:"completed",completedAt:new Date(wall()-Math.max(0,elapsed-state.targetSeconds)*1000).toISOString()};
      accumulated = state.elapsedSeconds; anchor=mono(); persist();
    }
    return {...state};
  };
  const checkpoint = () => { getState(); if(state){accumulated=state.elapsedSeconds;anchor=mono();persist();} };
  return {
    getState,
    checkpoint,
    start(input: PracticeState) {
      if(getState()) throw new Error("Resume or finish your existing meditation first.");
      state={...input};accumulated=0;anchor=mono();persist();return getState();
    },
    action(id:string,action:"pause"|"resume"|"finish"|"cancel"|"ack") {
      getState(); if(!state || state.id !== id) throw new Error("Your meditation session changed. Reopen the timer.");
      if(action === "cancel" || action === "ack") {
        if(action === "ack" && state.status !== "completed") throw new Error("Session has not finished.");
        state=null;persist();return null;
      }
      if(state.status === "completed") return getState();
      accumulated=state.elapsedSeconds;anchor=mono();
      state={...state,status:action === "finish" ? "completed" : action === "resume" ? "running" : "paused",
        ...(action === "finish" ? {completedAt:new Date(wall()).toISOString()} : {})};
      persist();return getState();
    }
  };
}
