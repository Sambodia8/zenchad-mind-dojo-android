// Original synthesized bowl: inharmonic partials, soft attack, natural decay.
import { mkdirSync, writeFileSync } from 'node:fs';
const rate=22050, duration=5, frames=rate*duration;
const wav=Buffer.alloc(44+frames*2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(frames*2,40);
for(let i=0;i<frames;i++){
  const t=i/rate, attack=1-Math.exp(-t*45), tail=Math.min(1,(duration-t)/0.25);
  const v=[[220,0.5,1.15],[443,0.2,1.65],[663,0.11,2],[918,0.07,2.6],[1327,0.035,3.2]].reduce((s,[f,a,d])=>s+Math.sin(2*Math.PI*f*t)*a*Math.exp(-t/d),0)*attack*tail*0.65;
  wav.writeInt16LE(Math.round(v*32767),44+i*2);
}
for(const path of ['public/assets/audio/ui/meditation-bowl.wav','android/app/src/main/res/raw/meditation_bowl.wav']) { mkdirSync(path.slice(0,path.lastIndexOf('/')),{recursive:true});writeFileSync(path,wav); }
console.log('Created original five-second meditation bowl for browser and Android.');
