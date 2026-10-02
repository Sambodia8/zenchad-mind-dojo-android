import { Capacitor, registerPlugin } from "@capacitor/core";
import { createBrowserPracticeClock } from "./meditationPracticeClock";
import type { PracticeState, PracticeMode, PracticePreset } from "./meditationPractice";

interface StateResult { state: PracticeState | null }
export interface PracticePermissions { exact: boolean; notifications: boolean; bellChannel: boolean }
interface PracticePlugin {
  getState(): Promise<StateResult>;
  start(state:PracticeState):Promise<StateResult>;
  pause(input:{id:string}):Promise<StateResult>;
  resume(input:{id:string}):Promise<StateResult>;
  finish(input:{id:string}):Promise<StateResult>;
  cancel(input:{id:string}):Promise<StateResult>;
  acknowledgeCompletion(input:{id:string}):Promise<StateResult>;
  permissionStatus():Promise<PracticePermissions>;
  requestExactAlarmAccess():Promise<void>;
  previewBell(input:{id?:string}):Promise<void>;
}
const native = registerPlugin<PracticePlugin>("MeditationPractice");
export const nativePractice = Capacitor.getPlatform() === "android";
let browserClock: ReturnType<typeof createBrowserPracticeClock> | undefined;
const browser = () => browserClock ??= createBrowserPracticeClock(localStorage);
let queue:Promise<unknown>=Promise.resolve();
function serial<T>(fn:()=>Promise<T>):Promise<T> { const next=queue.then(fn);queue=next.catch(()=>{});return next; }
export const practiceBridge = {
  getState:()=>serial(async()=> nativePractice ? (await native.getState()).state : browser().getState()),
  start:(preset:PracticePreset,mode:PracticeMode,targetSeconds:number,endingBell:boolean)=>serial(async()=>{
    const state:PracticeState={id:crypto.randomUUID(),preset,mode,targetSeconds,status:"running",elapsedSeconds:0,startedAt:new Date().toISOString(),endingBell};
    return nativePractice ? (await native.start(state)).state : browser().start(state);
  }),
  action:(id:string,action:"pause"|"resume"|"finish"|"cancel"|"ack")=>serial(async()=>{
    if(!nativePractice)return browser().action(id,action);
    return (await (action === "ack" ? native.acknowledgeCompletion({id}) : native[action]({id}))).state;
  }),
  permissions:async():Promise<PracticePermissions>=>nativePractice ? native.permissionStatus() : {exact:false,notifications:false,bellChannel:false},
  requestExactAccess:()=>native.requestExactAlarmAccess(),
  checkpoint:()=>{if(!nativePractice)browser().checkpoint();}
};
export function playPracticeBell(sessionId?:string) {
  if(nativePractice){void native.previewBell({id:sessionId}).catch(()=>{});return;}
  const audio = new Audio("assets/audio/ui/meditation-bowl.wav");audio.volume=0.65;void audio.play().catch(()=>{});
}
if(typeof window !== "undefined") {
  window.addEventListener("pagehide",()=>practiceBridge.checkpoint());
  document.addEventListener("visibilitychange",()=>practiceBridge.checkpoint());
}
