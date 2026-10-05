import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pinCommand,needsHold,formatMs,keyImage,keyImageDataUrl,numericBindings} from '../.test-build/logic.js';

test('LCD transport encodes SVG as an SDK image data URL, preserving Unicode',()=>{
  const svg=keyImage(L.defaultKey('bell',{name:'Zvonce − ć'}),snapshot());
  const image=keyImageDataUrl(svg);
  assert.match(image,/^data:image\/svg\+xml;base64,/);
  assert.equal(Buffer.from(image.split(',')[1],'base64').toString('utf8'),svg);
});
const require=createRequire(import.meta.url),L=require('../../deck-layout.js');
const active={mode:'countdown',status:'RUNNING',running:true,version:4,remainingMs:523000,elapsedMs:0};
const snapshot=()=>({selectedTimerId:'t1',editTarget:'set',timers:{t1:{active:{...active},draft:{mode:'countdown',durationMs:900000,version:8}},t2:{active:{...active,status:'READY',running:false,version:2},draft:{mode:'countdown',durationMs:600000,version:3}}}});
const headlineLines=svg=>[...svg.matchAll(/<text data-role="headline"[^>]*>([^<]*)<\/text>/g)].map(match=>match[1]);
test('LOAD READY pins both versions and live view keys show confirmed ON AIR state',()=>{
  const s=snapshot();s.singleTap=true;s.outputs={aOpen:true,bOpen:true};
  const key=L.defaultKey('loadSet'),cmd=pinCommand(key,s);
  assert.equal(cmd.type,'loadSet');assert.equal(cmd.expectedActiveVersion,4);assert.equal(cmd.expectedDraftVersion,8);
  assert.match(keyImage(key,s),/PAUSE FIRST/);s.timers.t1.active.running=false;assert.match(keyImage(key,s),/LOAD · NO START/);
  for(const [command,view]of [['liveT1','t1'],['liveBoth','both'],['liveT2','t2']]){
    s.liveTimerView=view;const button=L.defaultKey(command);
    assert.equal(pinCommand(button,s).type,command);assert.match(keyImage(button,s),/ON AIR/);
    s.liveTimerView=view==='t1'?'t2':'t1';assert.match(keyImage(button,s),/SEND LIVE/);
    s.liveTimerView=view;s.blackout=true;assert.doesNotMatch(keyImage(button,s),/ON AIR/);s.blackout=false;
  }
});
test('pins timer, SET/LIVE target and versions at keyDown without affecting ACTIVE',()=>{const s=snapshot(),c=pinCommand(L.defaultKey('adjust',{step:5,unit:'m'}),s);s.selectedTimerId='t2';s.editTarget='live';assert.equal(c.timerId,'t1');assert.deepEqual(c.payload,{step:5,unit:'m',target:'set'});const start=pinCommand(L.defaultKey('startSet'),s);assert.equal(start.expectedActiveVersion,2);assert.equal(start.expectedDraftVersion,3);assert.equal(s.timers.t1.active.remainingMs,523000);});
test('explicit transport follows running boolean even when paused overtime',()=>{const s=snapshot();s.timers.t1.active.status='OVERTIME';s.timers.t1.active.running=false;assert.equal(pinCommand(L.defaultKey('startPause'),s).type,'resume');s.timers.t1.active.running=true;assert.equal(pinCommand(L.defaultKey('startPause'),s).type,'pause');});
test('presets never resolve to LIVE and mode preparation uses supported commands',()=>{const s=snapshot();s.editTarget='live';assert.deepEqual(pinCommand(L.defaultKey('preset',{durationMs:3600000}),s).payload,{durationMs:3600000});for(const type of ['clock','countup','countdown'])assert.equal(pinCommand(L.defaultKey(type),s).type,type);});
test('single-purpose starter keys keep their operation and target despite state changes',()=>{
  const s=snapshot(),board=L.defaultLayout();
  for(const type of ['pause','start']){const key=board.slots.find(k=>k?.command===type);assert.equal(pinCommand(key,s).type,type);s.timers.t1.active.running=false;assert.equal(pinCommand(key,s).type,type);}
  s.editTarget='set';s.selectedTimerId='t2';
  for(const key of board.slots.slice(8,14)){
    const command=pinCommand(key,s);
    assert.equal(command.timerId,'t1');
    assert.deepEqual(command.payload,{step:key.step,unit:'m',target:'live'});
    assert.match(keyImage(key,s),/T1 LIVE/);
  }
  assert.deepEqual(pinCommand(board.slots[24],s).payload,{timerId:'t1'});
  assert.deepEqual(pinCommand(board.slots[25],s).payload,{timerId:'t2'});
  s.outputs={aOpen:true,bOpen:true};assert.deepEqual(pinCommand(board.slots[26],s).payload,{action:'open'});
  assert.equal(needsHold(board.slots[26],pinCommand(board.slots[26],s),s),false);
  assert.match(keyImage(board.slots[26],s),/NOW OPEN/);
  for(const key of board.slots.filter(key=>key&&!['activeTime','setTime'].includes(key.command)))assert.match(keyImage(key,s),/data-role="function-icon"/);
  assert.notEqual(L.iconSvg(L.commandIcon(board.slots[0])),L.iconSvg(L.commandIcon(board.slots[1])));
});

test('authoritative native one-touch policy applies to every executable key including imported hold settings',()=>{
  const s=snapshot();s.singleTap=true;s.outputs={aOpen:true,bOpen:true};
  for(const key of L.defaultLayout('full').slots.filter(Boolean)){
    key.pressPolicy='hold';
    assert.equal(needsHold(key,pinCommand(key,s),s),false,key.command);
    assert.doesNotMatch(keyImage(key,s),/HOLD 1\.5s/,key.command);
  }
  const svg=keyImage(L.defaultKey('activeTime'),s);
  assert.match(svg,/font-size="50\.0"/);
  assert.doesNotMatch(svg,/data-role="function-icon"/,'digits own the entire readout area');
  assert.match(keyImage(L.defaultKey('pause'),s),/scale\(1\.5\)/,'action icon is larger');
});

test('native monospace LCD readouts fit every digit of long and overtime times',()=>{
  const s=snapshot();s.singleTap=true;
  for(const value of ['15:00','01:23:45','99:59:59','−99:59:59']){
    s.timers.t1.active.display=value;
    const svg=keyImage(L.defaultKey('activeTime'),s);
    assert.deepEqual(headlineLines(svg),[value]);
    const size=Number(svg.match(/data-role="headline"[^>]*font-size="([\d.]+)"/)[1]);
    assert.ok([...value].length*.62*size<=124.1,`${value} fits LCD safe width`);
  }
  assert.match(keyImage(L.defaultKey('preset'),s),/stroke="#69b5ff"/,'default blue has readable native contrast');
});
test('function graphics distinguish live destinations, load, blackout and adjustment directions',()=>{
  const s=snapshot();s.singleTap=true;s.outputs={aOpen:false,bOpen:false};
  const icon=svg=>svg.match(/<g data-role="function-icon"[\s\S]*?<\/g>/)?.[0];
  assert.notEqual(icon(keyImage(L.defaultKey('liveT1'),s)),icon(keyImage(L.defaultKey('liveT2'),s)));
  assert.notEqual(icon(keyImage(L.defaultKey('liveT1'),s)),icon(keyImage(L.defaultKey('liveBoth'),s)));
  assert.notEqual(icon(keyImage(L.defaultKey('loadSet'),s)),icon(keyImage(L.defaultKey('startSet'),s)));
  assert.notEqual(icon(keyImage(L.defaultKey('blackoutOn'),s)),icon(keyImage(L.defaultKey('blackoutOff'),s)));
  const plus=keyImage(L.defaultKey('adjust',{step:1,unit:'m'}),s),minus=keyImage(L.defaultKey('adjust',{step:-1,unit:'m'}),s);
  assert.match(plus,/#53dfbb/);assert.match(minus,/#ff8f9c/);
  assert.match(plus,/data-role="color-surface"/);
  assert.match(keyImage(L.defaultKey('bell',{color:'#abcdef',icon:'settings'}),s),/#abcdef/);
  assert.notEqual(icon(keyImage(L.defaultKey('bell',{icon:'settings'}),s)),icon(keyImage(L.defaultKey('bell'),s)));
  assert.doesNotMatch(keyImage(L.defaultKey('startSet')),/stop-opacity="\.48"/,'offline rendering must not look live');
});
test('output keys pin their next action and closing requires a hold',()=>{
  const s=snapshot(),a=L.defaultKey('outputA'),b=L.defaultKey('outputB');
  s.outputs={aOpen:false,bOpen:true};
  assert.deepEqual(pinCommand(a,s).payload,{action:'open'});
  assert.equal(needsHold(a,pinCommand(a,s),s),false);
  assert.deepEqual(pinCommand(b,s).payload,{action:'close'});
  assert.equal(needsHold(b,pinCommand(b,s),s),true);
  delete s.outputs;
  assert.deepEqual(pinCommand(a,s).payload,{});
});
test('protected commands and deliberate LIVE cannot be short accidental presses',()=>{const s=snapshot();for(const type of ['reset','blackout','startSet','editTarget']){const key=L.defaultKey(type),c=pinCommand(key,s);assert.equal(needsHold(key,c,s),true);}assert.equal(needsHold(L.defaultKey('adjust'),pinCommand(L.defaultKey('adjust'),s),s),false);});
test('long hours and overtime use host format without wrapping at 24 hours',()=>{assert.equal(formatMs(301*600000),'50:10:00');assert.equal(formatMs(359999000),'99:59:59');assert.equal(formatMs(-1500),'−0:01');assert.equal(formatMs(NaN),'—');});
test('numeric layer owns exactly provided native action contexts, not foreign FREE coordinates',()=>{const contexts=Array.from({length:28},(_,i)=>`owned-${i}`),bindings=numericBindings(contexts);assert.equal(bindings.size,20);assert.equal(bindings.get('owned-0').type,'activeTime');assert.equal(bindings.get('owned-18').type,'numericCancel');assert.equal(bindings.get('owned-19').type,'clearSet');assert.equal(bindings.get('owned-2').value,'hours');assert.equal(bindings.has('foreign'),false);assert.equal(numericBindings(contexts.slice(0,19)),null);});
test('XL numeric overlay uses an owned spatial keypad and leaves column 8 untouched',()=>{
  const contexts=Array.from({length:4},(_,row)=>Array.from({length:8},(_,column)=>({id:`key-${row}-${column}`,row,column}))).flat();
  const bindings=numericBindings(contexts);
  assert.equal(bindings.size,20);
  for(const [row,column,digit] of [[0,4,'7'],[0,5,'8'],[0,6,'9'],[1,4,'4'],[1,5,'5'],[1,6,'6'],[2,4,'1'],[2,5,'2'],[2,6,'3'],[3,5,'0']])
    assert.equal(bindings.get(`key-${row}-${column}`).value,digit);
  assert.equal(bindings.get('key-0-0').type,'activeTime');
  assert.equal(bindings.get('key-0-1').type,'numericValue');
  assert.equal(bindings.get('key-3-0').type,'clearSet');
  assert.equal(bindings.get('key-3-1').type,'numericCancel');
  assert.equal(bindings.get('key-3-2').type,'numericApply');
  for(let row=0;row<4;row++)assert.equal(bindings.has(`key-${row}-7`),false);
});
test('custom numeric ownership falls back to coordinate order without needing the XL pattern',()=>{
  const contexts=Array.from({length:20},(_,index)=>({id:`custom-${index}`,row:Math.floor(index/8),column:index%8})).reverse();
  const bindings=numericBindings(contexts);
  assert.equal(bindings.get('custom-0').type,'activeTime');
  assert.equal(bindings.get('custom-19').type,'clearSet');
  assert.equal(numericBindings(contexts.slice(0,19)),null);
});
test('SET graphic names real READY and EDITING status; imported confirmation policy safely requires Deck hold',()=>{const s=snapshot(),key=L.defaultKey('setTime');assert.match(keyImage(key,s),/READY/);s.timers.t1.draft.status='EDITING';assert.match(keyImage(key,s),/EDITING/);const bell=L.defaultKey('bell',{pressPolicy:'confirm'});assert.equal(needsHold(bell,pinCommand(bell,s),s),true);});
test('cached SVG payload changes only with actual display state and escapes user titles',()=>{const s=snapshot(),key=L.defaultKey('activeTime');assert.equal(keyImage(key,s),keyImage(key,s));assert.match(keyImage(key,s),/8:43/);assert.match(keyImage(key,s),/T1 ACTIVE/);s.timers.t1.active.mode='countup';s.timers.t1.active.elapsedMs=14000;assert.match(keyImage(key,s),/0:14/);assert.match(keyImage(key),/OFFLINE/);assert.doesNotMatch(keyImage(key),/RUNNING/);assert.match(keyImage(L.defaultKey('bell',{name:'<script>&'}),s),/&lt;script&gt;&amp;/);assert.match(keyImage(L.defaultKey('back')),/PREV PROFILE/);});
test('LCD describes the next action and required hold without changing command guards',()=>{
  const s=snapshot(),short=L.defaultKey('startSet',{pressPolicy:'short'});
  assert.match(keyImage(L.defaultKey('startPause'),s),/T1 RUNNING/);
  assert.match(keyImage(L.defaultKey('startPause'),s),/>PAUSE<\/text>/);
  assert.match(keyImage(short,s),/HOLD 1\.5s/);
  s.timers.t1.active.status='READY';s.timers.t1.active.running=false;
  assert.doesNotMatch(keyImage(short,s),/HOLD 1\.5s/);
  s.timers.t1.active.durationMs=0;s.timers.t1.active.remainingMs=0;
  assert.deepEqual(headlineLines(keyImage(L.defaultKey('startPause'),s)),['USE','START SET']);
  assert.match(keyImage(L.defaultKey('startPause'),s),/NO ACTIVE TIME/);
  assert.match(keyImage(L.defaultKey('reset'),s),/HOLD 1\.5s/);
  assert.match(keyImage(L.defaultKey('editTarget'),s),/NOW SET/);
  assert.match(keyImage(L.defaultKey('editTarget'),s),/EDIT LIVE/);
  s.editTarget='live';
  assert.match(keyImage(L.defaultKey('editTarget'),s),/NOW LIVE/);
  assert.match(keyImage(L.defaultKey('editTarget'),s),/EDIT SET/);
  assert.doesNotMatch(keyImage(L.defaultKey('editTarget'),s),/HOLD 1\.5s/);
  assert.match(keyImage(L.defaultKey('selectTimer'),s),/SELECT TIMER/);
  assert.match(keyImage(L.defaultKey('selectTimer'),s),/TIMER 2/);
});
test('blackout and unavailable secondary output have current state cues',()=>{
  const s=snapshot();s.blackout=false;
  assert.match(keyImage(L.defaultKey('blackout'),s),/OUTPUT LIVE/);
  assert.match(keyImage(L.defaultKey('blackout'),s),/BLACKOUT/);
  assert.match(keyImage(L.defaultKey('blackout'),s),/HOLD 1\.5s/);
  s.blackout=true;
  assert.match(keyImage(L.defaultKey('blackout'),s),/OUTPUT BLACK/);
  assert.match(keyImage(L.defaultKey('blackout'),s),/RESTORE/);
  s.separateOutputs=false;
  assert.match(keyImage(L.defaultKey('outputB'),s),/SET UP/);
  assert.match(keyImage(L.defaultKey('outputB'),s),/T2 OUTPUT OFF/);
  s.separateOutputs=true;s.timers.t2.active.enabled=false;
  assert.match(keyImage(L.defaultKey('outputB'),s),/SET UP/);
  s.timers.t2.active.enabled=true;
  assert.doesNotMatch(keyImage(L.defaultKey('outputB'),s),/SET UP/);
  s.outputs={aOpen:true,bOpen:false};
  assert.match(keyImage(L.defaultKey('outputA'),s),/CLOSE/);
  assert.match(keyImage(L.defaultKey('outputA'),s),/HOLD 1\.5s/);
  assert.match(keyImage(L.defaultKey('outputB'),s),/OPEN/);
  assert.match(keyImage(L.defaultKey('outputB'),s),/NOW CLOSED/);
});
test('long custom names fit in at most two LCD headline lines',()=>{
  const name='ABCDEFGHIJKLMNOPQRSTUVWX1234';
  const svg=keyImage(L.defaultKey('bell',{name}),snapshot());
  const lines=headlineLines(svg);
  assert.equal(lines.length,2);
  assert.ok(lines.every(line=>[...line].length<=15));
  assert.ok(lines[1].endsWith('…'));
  assert.doesNotMatch(svg,new RegExp(name));
});
test('numeric overlay hides the underlying command icon',()=>{
  const svg=keyImage(L.defaultKey('reset',{icon:'reset'}),snapshot(),{label:'7',status:'SET ONLY'});
  assert.deepEqual(headlineLines(svg),['7']);
  assert.doesNotMatch(svg,/↺/);
});
