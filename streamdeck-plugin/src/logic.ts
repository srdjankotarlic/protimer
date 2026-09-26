import {randomUUID} from 'node:crypto';
import type {Command,Key,Snapshot,TimerId} from './types.js';
import {layout} from './shared.js';
export function pinCommand(key:Key,state:Snapshot):Command {
  const timerId:TimerId=key.timerId==='selected'?state.selectedTimerId:key.timerId;
  const timer=state.timers[timerId];let type=key.command;let payload:Record<string,unknown>={};
  if(type==='startPause')type=timer.active.running?'pause':['PAUSED','OVERTIME'].includes(timer.active.status)?'resume':'start';
  if(type==='adjust')payload={step:key.step,unit:key.unit,target:key.target==='selected'||!key.target?state.editTarget:key.target};
  if(type==='preset')payload={durationMs:key.durationMs};
  if(type==='editTarget')payload={target:state.editTarget==='set'?'live':'set'};
  if(type==='enterTime')type='numericBegin';
  return {commandId:randomUUID(),type,timerId,payload,...(type==='startSet'?{expectedActiveVersion:timer.active.version,expectedDraftVersion:timer.draft.version}:{})};
}
export function needsHold(key:Key,command:Command,state:Snapshot){return ['hold','confirm'].includes(key.pressPolicy||'')||['reset','blackout'].includes(command.type)||(command.type==='editTarget'&&state.editTarget==='set')||(command.type==='startSet'&&['RUNNING','PAUSED','OVERTIME'].includes(state.timers[command.timerId].active.status));}
export function formatMs(ms:number){
  if(!Number.isFinite(ms))return '—';
  const negative=ms<0,s=negative?Math.floor(-ms/1000):Math.ceil(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;
  return `${negative?'−':''}${h?h+':'+String(m).padStart(2,'0'):m}:${String(sec).padStart(2,'0')}`;
}
function xml(value:unknown){return String(value??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));}
export function keyImage(key:Key,state?:Snapshot,overlay?:{label:string;value?:string;status?:string},error?:string){
  const timerId=key.timerId==='selected'?(state?.selectedTimerId||'t1'):key.timerId,timer=state?.timers[timerId];
  let value=layout.label(key),label=timerId.toUpperCase(),status='';let color=/^#[0-9a-f]{6}$/i.test(key.color||'')?key.color!:'#6289b8';
  // Preserve visible labels even if a user chooses a dark accent in the editor.
  if([1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).reduce((a,b)=>a+b,0)<260)color='#ced8e8';
  if(!state){value=key.command==='back'?'BACK':'OFFLINE';status=key.command==='back'?'PREVIOUS PROFILE':'NO LIVE STATE';color='#77808d';}
  else if(key.command==='activeTime'&&timer){label+= ' ACTIVE';value=timer.active.display||(timer.active.mode==='clock'?'CLOCK':formatMs(timer.active.mode==='countup'?timer.active.elapsedMs??0:timer.active.remainingMs??0));status=timer.active.status;color=status==='OVERTIME'?'#ff665f':status==='RUNNING'?'#42d17d':status==='PAUSED'?'#ffcd5c':'#ccd5df';}
  else if(key.command==='setTime'&&timer){label+=' SET';value=formatMs(timer.draft.durationMs);status=timer.draft.status==='EDITING'?'EDITING':'READY';if(timer.draft.mode!=='countdown')status+=timer.draft.mode==='countup'?' / UP':' / CLOCK';color='#61adff';}
  else if(key.command==='adjust'){value=`${(key.step||0)>0?'+':'−'}${Math.abs(key.step||0)}${key.unit||'s'}`;status=(key.target==='selected'||!key.target?state.editTarget:key.target).toUpperCase();color=status==='LIVE'?'#ff665f':'#61adff';}
  else if(key.command==='editTarget'){value=`EDIT ${state.editTarget.toUpperCase()}`;status=state.editTarget==='live'?'LIVE / CAUTION':'PREPARE ONLY';color=state.editTarget==='live'?'#ff665f':'#61adff';}
  else if(key.command==='selectTimer'){value=state.selectedTimerId.toUpperCase();status='SELECT TIMER';}
  else if(key.command==='startPause'&&timer){value=timer.active.running?'PAUSE':['PAUSED','OVERTIME'].includes(timer.active.status)?'RESUME':'START';status='ACTIVE ONLY';}
  if(state&&key.stateDisplay===false&&!['activeTime','setTime','editTarget','adjust'].includes(key.command))status='';
  if(overlay){value=overlay.value||overlay.label;label=overlay.value?overlay.label:label;status=overlay.status||'ENTER TIME';color='#61adff';}
  if(error){value=error;status='CHECK CONTROL';color='#ffcd5c';}
  const font=Math.max(12,Math.min(key.textSize||23,Math.floor(126/Math.max(1,value.length)*1.55),28));
  const glyph=({play:'▶',pause:'Ⅱ',stop:'■',reset:'↺',bell:'♪',plus:'+',minus:'−',clock:'◷',timer:'◴',screen:'▣',grid:'▦',message:'…',settings:'⚙',back:'↩',up:'↑',down:'↓',left:'←',right:'→',lock:'●',edit:'✎'}as Record<string,string>)[key.icon||'']||'';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" rx="14" fill="#10151d"/><rect x="4" y="4" width="136" height="136" rx="11" fill="none" stroke="${color}" stroke-width="3"/><text x="72" y="26" fill="#ced5df" font-family="Arial,sans-serif" font-size="15" text-anchor="middle">${xml(label)}</text><text x="72" y="48" fill="${color}" font-family="Arial,sans-serif" font-size="15" text-anchor="middle">${xml(glyph)}</text><text x="72" y="81" fill="${color}" font-family="Arial,sans-serif" font-weight="bold" font-size="${font}" text-anchor="middle">${xml(value)}</text><text x="72" y="120" fill="#e3e9f2" font-family="Arial,sans-serif" font-size="12" text-anchor="middle">${xml(status)}</text></svg>`;
}
// Numeric overlay only binds contexts actually owned by this plugin. Never SDK
// coordinates alone: the same coordinates recur on other pages and devices.
export function numericBindings(contexts:string[]){
  const definitions=[['ACTIVE','activeTime'],['ENTRY','numericValue'],['HOURS','numericField','hours'],['MINUTES','numericField','minutes'],['SECONDS','numericField','seconds'],['7','numericDigit','7'],['8','numericDigit','8'],['9','numericDigit','9'],['4','numericDigit','4'],['5','numericDigit','5'],['6','numericDigit','6'],['1','numericDigit','1'],['2','numericDigit','2'],['3','numericDigit','3'],['0','numericDigit','0'],['⌫','numericBackspace'],['CLEAR ENTRY','numericClear'],['APPLY','numericApply'],['CANCEL','numericCancel'],['CLEAR SET','clearSet']];
  if(contexts.length<definitions.length)return null;
  return new Map(contexts.slice(0,definitions.length).map((context,i)=>[context,{label:definitions[i][0],type:definitions[i][1],value:definitions[i][2]}]));
}
