import {randomUUID} from 'node:crypto';
import type {Command,Key,Snapshot,TimerId} from './types.js';
import {layout} from './shared.js';
function nextOutputAction(type:string,state:Snapshot):'open'|'close'|undefined{
  const open=type==='outputA'?state.outputs?.aOpen:type==='outputB'?state.outputs?.bOpen:undefined;
  return typeof open==='boolean'?open?'close':'open':undefined;
}
export function pinCommand(key:Key,state:Snapshot):Command {
  const timerId:TimerId=key.timerId==='selected'?state.selectedTimerId:key.timerId;
  const timer=state.timers[timerId];let type=key.command;let payload:Record<string,unknown>={};
  if(type==='startPause')type=timer.active.running?'pause':['PAUSED','OVERTIME'].includes(timer.active.status)?'resume':'start';
  if(type==='adjust')payload={step:key.step,unit:key.unit,target:key.target==='selected'||!key.target?state.editTarget:key.target};
  if(type==='preset')payload={durationMs:key.durationMs};
  if(type==='outputA'||type==='outputB'){
    const action=key.outputAction&&key.outputAction!=='toggle'?key.outputAction:nextOutputAction(type,state);
    if(action)payload={action};
  }
  if(type==='editTarget')payload={target:state.editTarget==='set'?'live':'set'};
  if(type==='selectTimer'&&key.timerId!=='selected')payload={timerId:key.timerId};
  if(type==='enterTime')type='numericBegin';
  return {commandId:randomUUID(),type,timerId,payload,...(['startSet','loadSet'].includes(type)?{expectedActiveVersion:timer.active.version,expectedDraftVersion:timer.draft.version}:{})};
}
export function needsHold(key:Key,command:Command,state:Snapshot){if(state.singleTap===true)return false;return ['hold','confirm'].includes(key.pressPolicy||'')||['reset','blackout','blackoutOn','blackoutOff'].includes(command.type)||(command.type==='editTarget'&&state.editTarget==='set')||(['startSet','loadSet'].includes(command.type)&&['RUNNING','PAUSED','OVERTIME'].includes(state.timers[command.timerId].active.status))||(['outputA','outputB'].includes(command.type)&&command.payload?.action==='close');}
export function formatMs(ms:number){
  if(!Number.isFinite(ms))return '—';
  const negative=ms<0,s=negative?Math.floor(-ms/1000):Math.ceil(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;
  return `${negative?'−':''}${h?h+':'+String(m).padStart(2,'0'):m}:${String(sec).padStart(2,'0')}`;
}
function xml(value:unknown){return String(value??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));}
// setImage accepts a file path or data URL, not raw SVG markup.
export function keyImageDataUrl(svg:string){return `data:image/svg+xml;base64,${Buffer.from(svg,'utf8').toString('base64')}`;}
function widthUnits(value:string){
  return [...value].reduce((width,glyph)=>width+(/\s/.test(glyph)?.33:/[ilI1.,:;!'|]/.test(glyph)?.34:/[MW@#%&]/.test(glyph)?.9:/[^\u0000-\u00ff]/.test(glyph)?.9:.62),0);
}
function fitLine(value:string,font:number,width=124){
  if(widthUnits(value)*font<=width)return value;
  const chars=[...value];
  while(chars.length&&widthUnits(chars.join('').trimEnd()+'…')*font>width)chars.pop();
  return chars.join('').trimEnd()+'…';
}
function takeLine(value:string,budget:number):[string,string]{
  const chars=[...value];let width=0,end=0,lastSpace=-1;
  while(end<chars.length&&width+widthUnits(chars[end])<=budget){width+=widthUnits(chars[end]);if(/\s/.test(chars[end]))lastSpace=end;end++;}
  if(end===chars.length)return [value,''];
  if(lastSpace>Math.floor(end/2))end=lastSpace;
  end=Math.max(1,end);
  return [chars.slice(0,end).join('').trimEnd(),chars.slice(end).join('').trimStart()];
}
function fittedValue(value:string,requested:number,timeKey:boolean){
  const text=value.trim().replace(/\s+/g,' ');
  // Menlo is monospaced: colons and ones take the same cell as other digits.
  // Proportional-font estimates would clip values such as 15:00 or 01:23:45.
  const units=Math.max(1,timeKey?[...text].length*.62:widthUnits(text));
  const oneFont=Math.min(timeKey?58:36,requested*(timeKey?3:1.9),124/units);
  if(timeKey||oneFont>=22||(!text.includes(' ')&&oneFont>=20))
    return {lines:[fitLine(text,Math.max(18,oneFont))],font:Math.max(18,oneFont)};
  const breaks=[...text.matchAll(/ /g)].map(match=>match.index);
  if(breaks.length){
    const choices=breaks.map(index=>{
      const lines=[text.slice(0,index).trimEnd(),text.slice(index+1).trimStart()];
      const widths=lines.map(widthUnits);
      return {lines,score:Math.max(...widths)+Math.abs(widths[0]-widths[1])*.02};
    }).sort((a,b)=>a.score-b.score);
    const lines=choices[0].lines,font=Math.min(27,requested*1.5,Math.max(16,124/Math.max(...lines.map(widthUnits))));
    return {lines:lines.map(line=>fitLine(line,font)),font};
  }
  const font=Math.min(27,Math.max(16,260/units)),budget=124/font;
  const [first,rest]=takeLine(text,budget),[second,tail]=takeLine(rest,budget);
  return {lines:[fitLine(first,font),fitLine(tail?second+'…':second,font)],font};
}
// Original vector artwork, rendered by Stream Deck at its LCD resolution.
// User-picked icons take precedence; the defaults distinguish sending a picture
// from transport, loading a duration, and selecting the timer being edited.
function functionArtwork(key:Key,icon:string,timerId:TimerId){
  if(key.icon&&key.icon!=='none')return layout.iconSvg(icon).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
  const screen='<rect x="3" y="4" width="26" height="19" rx="3"/><path d="M11 28h10m-5-5v5"/>';
  if(['liveT1','liveT2','liveBoth'].includes(key.command))return screen+(key.command==='liveBoth'?'<path d="M16 5v17"/><text x="9" y="18" fill="currentColor" stroke="none" font-family="Arial,sans-serif" font-weight="700" font-size="10" text-anchor="middle">1</text><text x="23" y="18" fill="currentColor" stroke="none" font-family="Arial,sans-serif" font-weight="700" font-size="10" text-anchor="middle">2</text>':`<text x="16" y="19" fill="currentColor" stroke="none" font-family="Arial,sans-serif" font-weight="700" font-size="15" text-anchor="middle">${key.command==='liveT1'?'1':'2'}</text>`);
  if(['outputA','outputB'].includes(key.command))return screen+`<text x="16" y="19" fill="currentColor" stroke="none" font-family="Arial,sans-serif" font-weight="700" font-size="14" text-anchor="middle">${key.command==='outputA'?'A':'B'}</text>`;
  if(key.command==='loadSet')return '<rect x="18" y="4" width="11" height="24" rx="2"/><path d="M3 16h20m-6-6 6 6-6 6"/>';
  if(key.command==='startSet')return '<rect x="3" y="4" width="26" height="24" rx="4"/><path d="m13 10 9 6-9 6Z" fill="currentColor" stroke="none"/><path d="M1 16h7m-3-3 3 3-3 3"/>';
  if(key.command==='clearSet')return '<path d="m6 22 11-17a3 3 0 0 1 4-1l7 5a3 3 0 0 1 1 4L18 29H9Z"/><path d="m10 17 12 8M18 29h12"/>';
  if(['blackoutOn','blackoutOff','blackout'].includes(key.command))return '<path d="M2 16s5-8 14-8 14 8 14 8-5 8-14 8S2 16 2 16Z"/><circle cx="16" cy="16" r="4"/>'+(key.command==='blackoutOff'?'<path d="m23 25 3 3 5-6"/>':'<path d="M4 3 28 29"/>');
  if(key.command==='selectTimer')return `<circle cx="16" cy="16" r="12"/><text x="16" y="22" fill="currentColor" stroke="none" font-family="Arial,sans-serif" font-weight="700" font-size="17" text-anchor="middle">${key.timerId==='selected'?timerId==='t1'?'2':'1':timerId==='t1'?'1':'2'}</text>`;
  if(key.command==='enterTime')return '<rect x="4" y="2" width="24" height="28" rx="4"/><path d="M9 8h14"/><g fill="currentColor" stroke="none"><circle cx="10" cy="15" r="1.5"/><circle cx="16" cy="15" r="1.5"/><circle cx="22" cy="15" r="1.5"/><circle cx="10" cy="21" r="1.5"/><circle cx="16" cy="21" r="1.5"/><circle cx="22" cy="21" r="1.5"/><circle cx="16" cy="26" r="1.5"/></g>';
  return layout.iconSvg(icon).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
}
function defaultAccent(key:Key){
  if(key.command==='adjust')return (key.step||0)>0?'#53dfbb':'#ff8f9c';
  if(key.command==='preset')return (key.durationMs||300000)<=600000?'#69b5ff':(key.durationMs||300000)<=1800000?'#aa9cff':'#dd9eff';
  return ({startPause:'#55df97',start:'#55df97',resume:'#55df97',startSet:'#55df97',pause:'#ffd16a',reset:'#ffae70',bell:'#d8a0ff',loadSet:'#69d9ed',outputA:'#69b5ff',outputB:'#bb9bff',liveT1:'#69d9ed',liveT2:'#bb9bff',liveBoth:'#82b7ff',countdown:'#69b5ff',countup:'#53dfbb',clock:'#69d9ed',enterTime:'#69d9ed',clearSet:'#ffae70',blackoutOn:'#ff8f9c',blackoutOff:'#55df97',back:'#b9c7db',settings:'#b9c7db',message:'#ffd16a'}as Record<string,string>)[key.command]||'#9ab6de';
}
export function keyImage(key:Key,state?:Snapshot,overlay?:{label:string;value?:string;status?:string},error?:string){
  const timerId=key.timerId==='selected'?(state?.selectedTimerId||'t1'):key.timerId,timer=state?.timers[timerId];
  let value=layout.label(key),label=timerId.toUpperCase(),status='',dynamic=false,unavailable=false;
  let color=/^#[0-9a-f]{6}$/i.test(key.color||'')?key.color!:'#6289b8';
  // The editor's default blue is an accent on large UI cards, not a readable
  // foreground on a small LCD. Use the brighter native palette for that default.
  if(color.toLowerCase()==='#2563eb')color=defaultAccent(key);
  // Starter keys use a dark neutral accent. Give critical controls a distinct,
  // legible color on the LCD while retaining any brighter user-picked accent.
  if([1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).reduce((a,b)=>a+b,0)<260)
    color=defaultAccent(key);
  if(!state){value=key.command==='back'?'BACK':'OFFLINE';label=key.command==='back'?'CONTROL':label;status=key.command==='back'?'PREV PROFILE':'NO LIVE STATE';color='#77808d';}
  else {
    if(key.command==='activeTime'&&timer){dynamic=true;label+=' ACTIVE';value=timer.active.display||timer.active.text||(timer.active.mode==='clock'?'CLOCK':formatMs(timer.active.mode==='countup'?timer.active.elapsedMs??0:timer.active.remainingMs??0));status=timer.active.mode==='clock'?'CLOCK':timer.active.status;color=status==='OVERTIME'?'#ff665f':status==='RUNNING'?'#42d17d':status==='PAUSED'?'#ffcd5c':'#ccd5df';}
    else if(key.command==='setTime'&&timer){dynamic=true;label+=' SET';value=formatMs(timer.draft.durationMs);status=timer.draft.status==='EDITING'?'EDITING':'READY';if(timer.draft.mode!=='countdown')status+=timer.draft.mode==='countup'?' / UP':' / CLOCK';color='#61adff';}
    else if(key.command==='adjust'){dynamic=true;value=`${(key.step||0)>0?'+':'−'}${Math.abs(key.step||0)}${key.unit||'s'}`;status=(key.target==='selected'||!key.target?state.editTarget:key.target).toUpperCase();label+=` ${status}`;if(status==='LIVE')color='#ff665f';}
    else if(key.command==='editTarget'){dynamic=true;label=`NOW ${state.editTarget.toUpperCase()}`;value=state.editTarget==='set'?'EDIT LIVE':'EDIT SET';status=state.editTarget==='live'?'PREPARE ONLY':'LIVE / CAUTION';color=state.editTarget==='live'?'#61adff':'#ff665f';}
    else if(key.command==='selectTimer'){dynamic=true;label='SELECT TIMER';value=key.timerId==='selected'?`TIMER ${state.selectedTimerId==='t1'?'2':'1'}`:key.timerId==='t1'?'TIMER 1':'TIMER 2';status=key.timerId===state.selectedTimerId?'SELECTED':'SELECT';color=key.timerId===state.selectedTimerId?'#42d17d':'#8fcaff';}
    else if(key.command==='startPause'&&timer){
      dynamic=true;label=`${timerId.toUpperCase()} ${timer.active.status}`;
      const missingActive=timer.active.status==='READY'&&timer.active.mode==='countdown'&&((timer.active.durationMs??0)<=0||(timer.active.remainingMs??0)<=0);
      value=timer.active.running?'PAUSE':['PAUSED','OVERTIME'].includes(timer.active.status)?'RESUME':missingActive?'USE START SET':'START';
      status=missingActive?'NO ACTIVE TIME':'ACTIVE TIMER';color=value==='PAUSE'?'#ffcd5c':missingActive?'#ffcd5c':'#42d17d';
    }
    else if(key.command==='blackout'){
      dynamic=true;label=state.blackout===true?'OUTPUT BLACK':state.blackout===false?'OUTPUT LIVE':'OUTPUT';
      value=state.blackout===true?'RESTORE':'BLACKOUT';color=state.blackout===true?'#42d17d':'#ff665f';
    }
    else if(key.command==='blackoutOn'||key.command==='blackoutOff'){
      label=key.command==='blackoutOn'?'HIDE PICTURE':'RESTORE PICTURE';status=state.blackout===true?'NOW BLACK':'BLACK IS OFF';
      color=key.command==='blackoutOn'?'#ff665f':'#42d17d';
    }
    else if(['liveT1','liveBoth','liveT2'].includes(key.command)){
      const view={liveT1:'t1',liveT2:'t2',liveBoth:'both'}[key.command];
      const available=view==='t1'||state.timers.t2.active.enabled!==false;
      const opened=state.separateOutputs===true?view==='both'?state.outputs?.aOpen&&state.outputs?.bOpen:view==='t2'?state.outputs?.bOpen:state.outputs?.aOpen:state.outputs?.aOpen;
      label='SEND TO SCREEN';status=!available?'ENABLE T2':(state.liveTimerView||'both')===view&&opened&&!state.blackout?'ON AIR':'SEND LIVE';
      color=status==='ON AIR'?'#42d17d':defaultAccent(key);
    }
    else if(key.command==='loadSet'&&timer){label+=' READY → ACTIVE';status=timer.active.running?'PAUSE FIRST':'LOAD · NO START';color=timer.active.running?'#ffcd5c':defaultAccent(key);}
    else if(key.command==='outputA'||key.command==='outputB'){
      label=key.command==='outputA'?'OUTPUT A':'OUTPUT B';
      const action=key.outputAction&&key.outputAction!=='toggle'?key.outputAction:nextOutputAction(key.command,state);
      if(action){dynamic=true;value=action.toUpperCase();const open=key.command==='outputA'?state.outputs?.aOpen:state.outputs?.bOpen;status=open===true?'NOW OPEN':open===false?'NOW CLOSED':'';color=action==='close'?'#ffcd5c':'#8fcaff';}
      const t2=state.timers.t2.active as typeof state.timers.t2.active & {enabled?:boolean};
      unavailable=key.command==='outputB'&&(state.separateOutputs===false||t2.enabled===false);
      if(unavailable){value='SET UP';status='T2 OUTPUT OFF';color='#ffcd5c';}
    }
    else if(['pause','resume','start'].includes(key.command)&&timer){label+= ' ACTIVE';status=timer.active.status;color=key.command==='pause'?'#ffcd5c':'#42d17d';}
    else if(['bell','message','settings','back'].includes(key.command)){label='CONTROL';if(key.command==='bell')status='ONE RING';}
    else if(['preset','countdown','countup','clock','clearSet','enterTime'].includes(key.command))label+= ' SET';
    else if(['startSet','reset'].includes(key.command)){label+=key.command==='startSet'?' SET':' ACTIVE';if(key.command==='startSet')status='START PREPARED';}
    if(dynamic&&key.name)label=key.name;
    if(key.stateDisplay===false&&!['activeTime','setTime','editTarget','adjust'].includes(key.command))status='';
    const action=key.outputAction&&key.outputAction!=='toggle'?key.outputAction:nextOutputAction(key.command,state);
    if(needsHold(key,{commandId:'display',type:key.command,timerId,payload:action?{action}:{}},state))status='HOLD 1.5s';
    if(unavailable)status='T2 OUTPUT OFF';
  }
  if(overlay){value=overlay.value||overlay.label;label=overlay.value?overlay.label:label;status=overlay.status||'ENTER TIME';color='#61adff';}
  if(error){value=error;status='CHECK CONTROL';color='#ffcd5c';}
  const timeKey=['activeTime','setTime'].includes(key.command)||/^[−-]?\d{1,2}:\d{2}(?::\d{2})?$/.test(value);
  const requested=Math.max(12,Math.min(key.textSize||18,28));
  const {lines,font}=fittedValue(value,requested,timeKey);
  let icon=layout.commandIcon(key);
  if(key.command==='startPause')icon=value==='PAUSE'?'pause':'play';
  // Vector artwork stays crisp on XL LCDs. Readouts reserve the central area
  // entirely for digits; action keys give the function icon its own large zone.
  const artwork=overlay||error||timeKey?'':`<g data-role="function-icon" transform="${lines.length===1?'translate(48 29) scale(1.5)':'translate(52 29) scale(1.25)'}" color="#ffffff" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${functionArtwork(key,icon,timerId)}</g>`;
  const topFont=Math.min(13,124/Math.max(1,widthUnits(label))),fittedTop=fitLine(label,Math.max(11,topFont));
  const bottomFont=timeKey?14:11,fittedBottom=fitLine(status,bottomFont);
  const headline=lines.map((line,index)=>`<text data-role="headline" x="72" y="${timeKey?94:overlay||error?lines.length===1?92:76+index*27:lines.length===1?108:89+index*26}" fill="#ffffff" font-family="${timeKey?'Menlo,monospace':'Arial,sans-serif'}" font-weight="700" font-size="${font.toFixed(1)}" text-anchor="middle">${xml(line)}</text>`).join('');
  const badgeWidth=Math.min(128,Math.max(48,widthUnits(fittedBottom)*bottomFont+16));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><defs><linearGradient id="surface" x2="0" y2="1"><stop stop-color="${color}" stop-opacity="${state?'.48':'.12'}"/><stop offset="1" stop-color="${color}" stop-opacity="${state?'.16':'.06'}"/></linearGradient></defs><rect width="144" height="144" rx="14" fill="#101720"/><rect data-role="color-surface" x="3" y="3" width="138" height="138" rx="12" fill="url(#surface)" stroke="${color}" stroke-opacity=".65" stroke-width="1.5"/><path d="M20 4h104" stroke="${color}" stroke-width="4" stroke-linecap="round"/><text x="72" y="22" fill="${color}" font-family="Arial,sans-serif" font-size="${Math.max(11,topFont).toFixed(1)}" font-weight="700" text-anchor="middle">${xml(fittedTop)}</text>${artwork}${headline}${status?`<rect x="${((144-badgeWidth)/2).toFixed(1)}" y="${timeKey?109:120}" width="${badgeWidth.toFixed(1)}" height="19" rx="6" fill="#080d14" fill-opacity=".65"/>`:''}<text x="72" y="${timeKey?124:134}" fill="${color}" font-family="Arial,sans-serif" font-size="${bottomFont}" font-weight="700" text-anchor="middle">${xml(fittedBottom)}</text></svg>`;
}
// Numeric overlay only binds contexts actually owned by this plugin. Never SDK
// coordinates alone: the same coordinates recur on other pages and devices.
export function numericBindings(contexts:Array<string|{id:string;row:number;column:number}>){
  const definitions=[['ACTIVE','activeTime'],['ENTRY','numericValue'],['HOURS','numericField','hours'],['MINUTES','numericField','minutes'],['SECONDS','numericField','seconds'],['7','numericDigit','7'],['8','numericDigit','8'],['9','numericDigit','9'],['4','numericDigit','4'],['5','numericDigit','5'],['6','numericDigit','6'],['1','numericDigit','1'],['2','numericDigit','2'],['3','numericDigit','3'],['0','numericDigit','0'],['⌫','numericBackspace'],['CLEAR ENTRY','numericClear'],['APPLY','numericApply'],['CANCEL','numericCancel'],['CLEAR SET','clearSet']];
  if(contexts.length<definitions.length)return null;
  // On a populated XL, keep entry/actions at the left and a conventional
  // keypad at the right. These positions are used only when our own visible
  // actions occupy every required coordinate; foreign keys are never bound.
  const positions=[[0,0],[0,1],[1,0],[1,1],[1,2],[0,4],[0,5],[0,6],[1,4],[1,5],[1,6],[2,4],[2,5],[2,6],[3,5],[2,0],[2,1],[3,2],[3,1],[3,0]];
  const located=contexts.filter((context):context is {id:string;row:number;column:number}=>typeof context!=='string'&&Number.isInteger(context.row)&&Number.isInteger(context.column));
  const byPosition=new Map(located.map(context=>[`${context.row},${context.column}`,context.id]));
  const preferred=positions.map(([row,column])=>byPosition.get(`${row},${column}`));
  let ids:string[];
  if(preferred.every((id):id is string=>!!id)&&new Set(preferred).size===definitions.length)ids=preferred as string[];
  else ids=(located.length===contexts.length?[...located].sort((a,b)=>a.row-b.row||a.column-b.column):contexts).map(context=>typeof context==='string'?context:context.id).slice(0,definitions.length);
  if(new Set(ids).size!==definitions.length)return null;
  return new Map(ids.map((id,i)=>[id,{label:definitions[i][0],type:definitions[i][1],value:definitions[i][2]}]));
}
