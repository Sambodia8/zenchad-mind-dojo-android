import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Bell, Check, Clock3, Eye, EyeOff, Pause, Play, Sparkles, Timer, X } from "lucide-react";
import type { AppData, Route } from "../types";
import { creditedPracticeSeconds, DEFAULT_PRACTICE_PREFERENCES, focusGoalDays, formatPracticeTime, goalDates, practiceXp, startFocusGoal, type PracticePreferences, type PracticePreset, type PracticeState } from "../meditationPractice";
import { nativePractice, playPracticeBell, practiceBridge, type PracticePermissions } from "../meditationPracticeBridge";
import { recordPracticeCompletion, saveData } from "../storage";
import { allowScreenSleep, keepScreenAwake, requestNotificationPermission } from "../native";
import { localCalendarDayDistance, localDateKey } from "../streakFreeze";
import "../meditationPractice.css";

interface Props { preset: PracticePreset; sessionId?: string; data: AppData; setData: Dispatch<SetStateAction<AppData>>; navigate: Dispatch<SetStateAction<Route>> }
const dateLabel = (day:string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined,{day:"numeric",month:"short"});

export default function MeditationPracticeScreen({preset,sessionId,data,setData,navigate}:Props) {
  const prefs=data.practicePreferences ?? DEFAULT_PRACTICE_PREFERENCES;
  const [state,setState]=useState<PracticeState|null>(null);
  const [loaded,setLoaded]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState("");
  const [finishChoice,setFinishChoice]=useState(false);
  const [minutes,setMinutes]=useState(String(Math.floor(prefs.durationSeconds/60)));
  const [seconds,setSeconds]=useState(String(prefs.durationSeconds%60));
  const [permissions,setPermissions]=useState<PracticePermissions|null>(null);
  const [guidedConflict,setGuidedConflict]=useState<string|null>(null);
  const mounted=useRef(true),operating=useRef(false),bellPlayed=useRef<string|null>(null),completionProcessing=useRef<string|null>(null);
  const stateRef=useRef(state);stateRef.current=state;
  const focus=(state?.preset ?? preset)==="focus-refocus";
  const mode=focus ? "countdown" : prefs.mode;
  const target=focus ? 780 : Number(minutes)*60+Number(seconds);
  const validDuration=minutes.trim()!=="" && seconds.trim()!=="" && Number.isInteger(Number(minutes)) && Number.isInteger(Number(seconds)) && Number(minutes)>=0 && Number(seconds)>=0 && Number(seconds)<60 && target>=60 && target<=10800;
  const receipt=data.practiceSessions.find(s=>s.id===(state?.id ?? sessionId));
  const completed=state?.status==="completed" || Boolean(receipt);
  const name=focus ? "Focus & refocus" : "Meditation timer";
  const updatePrefs=(patch:Partial<PracticePreferences>)=>setData(current=>({...current,practicePreferences:{...current.practicePreferences,...patch}}));
  const accept=async(next:PracticeState|null)=>{
    if(!mounted.current)return;
    // A poll begun before Finish must not replace its completed receipt with paused state.
    if(next && next.id===completionProcessing.current && next.status!=="completed")return;
    if(next){setState(next);stateRef.current=next;}
    if(next?.status!=="completed" || completionProcessing.current===next.id)return;
    completionProcessing.current=next.id;
    try {
      setData(current=>{const result=recordPracticeCompletion(current,next);saveData(result);return result;});
      if(next.endingBell && !next.bellDelivered && bellPlayed.current!==next.id && (!nativePractice || !permissions?.notifications)) {
        bellPlayed.current=next.id;playPracticeBell(next.id);
      }
    }catch(e){completionProcessing.current=null;setError(e instanceof Error ? e.message : "Could not save your practice. Reopen the timer to retry.");}
  };
  const acceptRef=useRef(accept);acceptRef.current=accept;
  useEffect(()=>{
    mounted.current=true;
    const refresh=async()=>{
      if(operating.current)return;
      try {const next=await practiceBridge.getState();if(mounted.current)await acceptRef.current(next);}
      catch(e){if(mounted.current)setError(e instanceof Error ? e.message : "Could not read the timer.");}
      finally{if(mounted.current)setLoaded(true);}
    };
    const permissionRefresh=()=>void practiceBridge.permissions().then(p=>{if(mounted.current)setPermissions(p);}).catch(()=>{});
    void refresh();permissionRefresh();
    const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void refresh();},500);
    const checkpoint=window.setInterval(()=>practiceBridge.checkpoint(),10000);
    const visible=()=>{if(document.visibilityState==="visible"){void refresh();permissionRefresh();}};
    document.addEventListener("visibilitychange",visible);window.addEventListener("focus",visible);
    return()=>{mounted.current=false;window.clearInterval(timer);window.clearInterval(checkpoint);document.removeEventListener("visibilitychange",visible);window.removeEventListener("focus",visible);};
  },[]);
  useEffect(()=>{
    if(state?.status==="running" && prefs.keepAwake)void keepScreenAwake();else void allowScreenSleep();
    return()=>{void allowScreenSleep();};
  },[state?.status,prefs.keepAwake]);
  useEffect(()=>{
    if(state?.status==="completed" && data.practiceSessions.some(s=>s.id===state.id)) {
      // Acknowledge only the persisted receipt, never a merely queued React update.
      try {
        const saved=JSON.parse(localStorage.getItem("zenchad_app_data_v1") ?? "{}");
        if(saved.practiceSessions?.some((s:{id:string})=>s.id===state.id))void practiceBridge.action(state.id,"ack").catch(()=>{});
      } catch { setError("Your practice is waiting to be saved. Reopen the timer to retry."); }
    }
  },[state?.id,state?.status,data.practiceSessions]);
  const run=async(fn:()=>Promise<void>)=>{
    if(operating.current)return;operating.current=true;setBusy(true);setError("");
    try{await fn();}catch(e){setError(e instanceof Error ? e.message : "That action could not be completed.");}
    finally{operating.current=false;if(mounted.current)setBusy(false);}
  };
  const start=()=>void run(async()=>{
    const existing=await practiceBridge.getState();if(existing){await accept(existing);return;}
    const guided=JSON.parse(localStorage.getItem("zenchad_active_timer_v1") ?? "null");
    if(guided?.started && !guided.completed){setGuidedConflict(guided.meditationId);return;}
    if(!focus && mode==="countdown" && !validDuration)throw new Error("Choose a duration from 1 minute to 3 hours.");
    const next=await practiceBridge.start(preset,mode,mode==="stopwatch" ? prefs.durationSeconds : target,focus || prefs.endingBell);
    if(!focus && validDuration)updatePrefs({durationSeconds:target});
    if(!focus && prefs.startingBell)playPracticeBell();await accept(next);
  });
  const action=(type:"pause"|"resume"|"finish"|"cancel")=>void run(async()=>{
    if(!stateRef.current)return;
    const next=await practiceBridge.action(stateRef.current.id,type);
    if(type==="cancel"){setState(null);stateRef.current=null;}else await accept(next);
    if(type==="finish" || type==="cancel")setFinishChoice(false);
  });
  const enableAlerts=()=>void run(async()=>{
    const result=await requestNotificationPermission();if(!result.ok)throw new Error(result.reason ?? "Notifications are disabled. You can keep the screen awake instead.");
    await practiceBridge.requestExactAccess();setPermissions(await practiceBridge.permissions());
  });
  const days=focusGoalDays(data),dates=data.focusGoal ? goalDates(data.focusGoal.startedDay) : [];
  const today=localDateKey(new Date()), goalEnded=Boolean(data.focusGoal && (localCalendarDayDistance(data.focusGoal.startedDay,today) ?? 0)>=56);
  const goal=<section className="practice-goal">
    <div className="practice-section-heading"><Sparkles size={19}/><h2>Your eight-week focus goal</h2></div>
    {!data.focusGoal ? <><p>Try 13 minutes a day. Returning your attention is the practice; a wandering mind is welcome.</p><button className="button secondary full" onClick={()=>setData(c=>({...c,focusGoal:startFocusGoal()}))}>Begin my eight-week goal</button></> : <>
      <p><strong>{days.size} of 56 practice days</strong> · {dateLabel(dates[0])} – {dateLabel(dates[55])}</p>
      <div className="practice-calendar" aria-label="Eight weeks of daily focus practice">{Array.from({length:8},(_,week)=><div className="practice-week" key={week}><span>Week {week+1}</span><div>{dates.slice(week*7,week*7+7).map(day=><span className={`practice-day ${days.has(day)?"done":""} ${day===today?"today":""}`} key={day} title={`${dateLabel(day)}: ${days.has(day)?"practised":"not recorded"}`} aria-label={`${dateLabel(day)}: ${days.has(day)?"practised":"not recorded"}`} role="img">{days.has(day)?<Check size={13}/>:Number(day.slice(-2))}</span>)}</div><b>{dates.slice(week*7,week*7+7).filter(d=>days.has(d)).length}/7</b></div>)}</div>
      <p>{!prefs.encouragementEnabled ? goalEnded ? `Goal finished: ${days.size} completed days.` : days.has(today) ? "Today's practice is recorded." : "Today's practice is not recorded yet." : goalEnded ? `You made space for ${days.size} days of practice. Carry that forward.` : days.has(today) ? "Today's practice is complete. Take that steadiness into your day." : "A little space today is enough. Missed days do not erase your progress."}</p>
      {!goalEnded && <button className="button primary full" disabled={busy} onClick={start}>Practise today's 13 minutes</button>}
      {goalEnded && <button className="button secondary full" onClick={()=>setData(c=>({...c,focusGoal:startFocusGoal()}))}>Start another eight weeks</button>}
    </>}
    <label className="practice-encouragement"><input type="checkbox" checked={prefs.encouragementEnabled} onChange={e=>updatePrefs({encouragementEnabled:e.target.checked})}/> Gentle encouragement in the app</label>
  </section>;
  if(!loaded)return <div className="practice-screen"><p role="status">Opening your meditation space…</p></div>;
  const elapsed=state ? creditedPracticeSeconds(state) : 0;
  const remaining=state ? Math.max(0,Math.ceil(state.targetSeconds-state.elapsedSeconds)) : target;
  const total=state?.targetSeconds ?? target;
  const progress=state?.mode==="countdown" ? Math.min(1,(state.elapsedSeconds/total)) : 0;
  return <div className={`practice-screen atmosphere-${data.preferences.selectedTheme} ${data.preferences.reducedMotion?"practice-still":""}`}>
    <div className="practice-landscape" aria-hidden="true"/>
    <section className={`practice-sanctuary ${state&&!completed?"is-active":""}`}>
      <div className="practice-section-heading"><span className="practice-eyebrow">{focus?"13 minutes for attention":"A little space for yourself"}</span><span className="practice-symbol"><Timer size={20}/></span></div>
      <h1>{name}</h1>
      {error && <p className="practice-error" role="alert">{error}</p>}
      {completed ? <div className="practice-completion">
        <div className="practice-completion-mark"><Check size={36}/></div><h2>Practice saved</h2>
        <p>{formatPracticeTime(receipt?.activeSeconds ?? elapsed)} of time for yourself</p>
        <div className="practice-rewards"><strong>+{receipt?.xp ?? practiceXp(elapsed)} XP</strong><span>+{receipt?.zenPoints ?? 0} ZenPoints</span></div>
        {(receipt?.activeSeconds ?? elapsed)<60 && <p>Sessions under a minute are recorded without rewards.</p>}
        <button className="button primary full" onClick={()=>navigate({name:"progress"})}>View my progress</button>
        <button className="button secondary full" onClick={()=>navigate({name:"journal",draftMeditation:name})}>Reflect in my journal</button>
        <button className="button secondary full" onClick={()=>void run(async()=>{if(state)await practiceBridge.action(state.id,"ack").catch(()=>{});setState(null);stateRef.current=null;completionProcessing.current=null;navigate({name:"meditation-timer",preset});})}>Another practice</button>
      </div> : state ? <>
        {state.preset!==preset && <p className="practice-note">Your existing {state.preset==="focus-refocus"?"focus":"free"} practice is here. Finish it before starting another.</p>}
        <div className={`practice-clock ${prefs.hideClock?"clock-hidden":""}`}>
          {state.mode==="countdown" && !prefs.hideClock && <svg viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="110" className="practice-ring-track"/><circle cx="120" cy="120" r="110" className="practice-ring-progress" strokeDasharray={Math.PI*220} strokeDashoffset={Math.PI*220*(1-progress)}/></svg>}
          {prefs.hideClock ? <div className="practice-quiet"><span aria-hidden="true">◌</span><p>Nothing to do.<br/>Gently return.</p></div> : <div className="practice-clock-content"><span>{state.mode==="countdown"?"Time remaining":"Time here"}</span><strong aria-label={state.mode==="countdown"?"Remaining time":"Elapsed time"}>{formatPracticeTime(state.mode==="countdown"?remaining:elapsed)}</strong><small>{elapsed>=60?`${practiceXp(elapsed)} XP · estimate`:"XP begins at one minute"}</small></div>}
        </div>
        <p className="practice-status" role="status">{state.status==="interrupted" ? "Interrupted by a phone restart. Resume when you are ready." : state.status==="paused" ? "Paused · your time is held" : "Let your breathing be natural."}</p>
        <div className="practice-controls"><button className="button primary" disabled={busy} onClick={()=>action(state.status==="running"?"pause":"resume")}>{state.status==="running"?<Pause size={18}/>:<Play size={18}/>} {state.status==="running"?"Pause":"Resume"}</button><button className="button secondary" disabled={busy} onClick={()=>{if(state.status==="running")action("pause");setFinishChoice(true);}}>Finish</button></div>
        <button className="button practice-hide" onClick={()=>updatePrefs({hideClock:!prefs.hideClock})}>{prefs.hideClock?<Eye size={17}/>:<EyeOff size={17}/>} {prefs.hideClock?"Show clock":"Hide clock & XP"}</button>
        {finishChoice && <div className="practice-finish" role="dialog" aria-modal="true" aria-label="Finish your practice"><h2>Finish here?</h2><p>Save {formatPracticeTime(elapsed)} of actual practice. Paused time is excluded.</p><button className="button primary full" disabled={busy} onClick={()=>action("finish")}>Finish & save practice</button><button className="button secondary full" disabled={busy} onClick={()=>action("cancel")}><X size={16}/> Discard this session</button><button className="button secondary full" disabled={busy} onClick={()=>setFinishChoice(false)}>Stay here, paused</button></div>}
      </> : <>
        {focus ? <div className="practice-intro"><p>Train the gentle return of your attention.</p><ol><li>Sit or lie comfortably and close your eyes.</li><li>Breathe naturally, through your nose if comfortable.</li><li>Rest attention on the breath. Huberman suggests also imagining a point about an inch behind your forehead.</li><li>When your mind wanders, notice and gently return. Each return is part of the practice.</li></ol><p className="practice-note">Practise earlier in the day. Huberman recommends leaving four hours before bedtime for this focus exercise.</p><div className="practice-target"><Clock3 size={19}/> 13:00 · silence, then your ending bell</div></div> : <>
          <p className="practice-lead">Choose a little time, or let it unfold.</p>
          <div className="practice-modes" aria-label="Timer mode"><button aria-pressed={mode==="countdown"} onClick={()=>updatePrefs({mode:"countdown"})}><Timer size={17}/> Countdown</button><button aria-pressed={mode==="stopwatch"} onClick={()=>updatePrefs({mode:"stopwatch"})}><Clock3 size={17}/> Stopwatch</button></div>
          {mode==="countdown" ? <><div className="practice-presets">{[5,10,13,20,30].map(m=><button key={m} aria-pressed={target===m*60} onClick={()=>{setMinutes(String(m));setSeconds("0");updatePrefs({durationSeconds:m*60});}}>{m}<small>min</small></button>)}</div><div className="practice-duration"><label>Minutes<input inputMode="numeric" type="number" min="0" max="180" step="1" value={minutes} onChange={e=>{setMinutes(e.target.value);const value=Number(e.target.value)*60+Number(seconds);if(Number.isInteger(value)&&value>=60&&value<=10800)updatePrefs({durationSeconds:value});}}/></label><span>:</span><label>Seconds<input inputMode="numeric" type="number" min="0" max="59" step="1" value={seconds} onChange={e=>{setSeconds(e.target.value);const value=Number(minutes)*60+Number(e.target.value);if(Number.isInteger(value)&&value>=60&&value<=10800&&Number(e.target.value)<60)updatePrefs({durationSeconds:value});}}/></label></div><p className="practice-duration-note">{validDuration ? `${formatPracticeTime(target)} of practice · ${practiceXp(target)} XP` : "Choose 1 minute to 3 hours; seconds must be 0–59."}</p></> : <div className="practice-stopwatch-intro"><strong>00:00</strong><p>No target to chase. Finish whenever you feel ready.</p></div>}
        </>}
        <div className="practice-bells"><div className="practice-section-heading"><Bell size={18}/><h2>Gentle bells</h2><button className="button practice-preview" onClick={()=>playPracticeBell()}>Preview</button></div>{focus ? <p>Silent practice, with one ending bowl.</p> : <><label><input type="checkbox" checked={prefs.startingBell} onChange={e=>updatePrefs({startingBell:e.target.checked})}/> Starting bowl</label><label><input type="checkbox" checked={prefs.endingBell} onChange={e=>updatePrefs({endingBell:e.target.checked})}/> Ending bowl</label></>}<label><input type="checkbox" checked={prefs.keepAwake} onChange={e=>updatePrefs({keepAwake:e.target.checked})}/> Keep screen awake</label></div>
        {nativePractice && permissions && <div className="practice-permissions"><p>{permissions.exact && permissions.notifications && (!prefs.endingBell || permissions.bellChannel) ? "Ready for locked-phone completion. Bells follow your phone's sound settings." : "For a timed ending bell with your phone locked, enable notifications and Alarms & reminders. You can keep the screen awake instead."}</p>{(!permissions.exact || !permissions.notifications) && <button className="button secondary full" disabled={busy} onClick={enableAlerts}>Enable locked-phone alerts</button>}{permissions.exact&&permissions.notifications&&prefs.endingBell&&!permissions.bellChannel&&<p>The ending-bell channel is muted. Enable its sound in Android notification settings to hear the bowl.</p>}</div>}
        {guidedConflict && <div className="practice-note"><p>Finish or resume your existing guided meditation first.</p><button className="button secondary full" onClick={()=>navigate({name:"timer",meditationId:guidedConflict})}>Return to guided meditation</button></div>}
        <button className="button primary full practice-start" disabled={busy || (!focus&&mode==="countdown"&&!validDuration)} onClick={start}><Play size={19}/> {focus?"Begin 13-minute practice":"Begin meditation"}</button>
      </>}
    </section>
    {focus && (!state || completed) && goal}
    {focus && (!state || completed) && <details className="practice-evidence"><summary>About the practice & evidence</summary><p>This silent ZenChad practice adapts Andrew Huberman's focus and refocus instructions. It is not the guided recording used in the study and is not affiliated with Huberman Lab.</p><p>Basso and colleagues studied daily 13-minute guided meditation in new meditators. Compared with podcast listening, improvements in attention, memory, mood and stress-related anxiety were observed after eight weeks, but not four. Results are not guaranteed for this adaptation.</p><a href="https://www.hubermanlab.com/episode/focus-toolkit-tools-to-improve-your-focus-and-concentration" target="_blank" rel="noreferrer">Huberman's focus toolkit ↗</a><a href="https://scholars.mssm.edu/en/publications/brief-daily-meditation-enhances-attention-memory-mood-and-emotion-2/" target="_blank" rel="noreferrer">Basso et al. study ↗</a></details>}
    {!state && !completed && data.practiceSessions.length>0 && <details className="practice-evidence"><summary>Recent timer practices</summary><ul>{data.practiceSessions.slice(0,7).map(s=><li key={s.id}>{dateLabel(s.practiceDay)} · {s.preset==="focus-refocus"?"Focus & refocus":"Free practice"} · {formatPracticeTime(s.activeSeconds)} · +{s.xp} XP</li>)}</ul></details>}
  </div>;
}
