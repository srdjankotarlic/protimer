'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {isFullscreen}=require('../window-tools');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
// Real Electron renderer + native loopback transport, with a simulated plugin
// HTTP client. This is NOT an Elgato runtime or physical USB test.
module.exports = async function smokeDeck({ controlWin, deckHost, getOutput, getSecondary }) {
  const js = code => controlWin.webContents.executeJavaScript(code);
  for (let n=0;n<100 && !await js('!!deckControl');n++) await delay(50);
  assert.equal(await js('!!deckControl'),true,'Deck controller must mount');
  const base = await js('({s:JSON.parse(JSON.stringify(S)),cues:JSON.parse(JSON.stringify(cues))})');
  const port=await deckHost.bridge.start(), bootstrap=deckHost.bridge.bootstrap();
  let token,sequence=0;
  async function request(route,body){const res=await fetch(`http://127.0.0.1:${port}${route}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return res.json();}
  token=(await request('/pair',{nonce:bootstrap.nonce,protocolVersion:1,pluginVersion:'0.1.0'})).token;
  assert.ok(token);
  await request('/inventory',{devices:[{id:'smoke-xl',name:'SIMULATED XL',type:2}],actions:[]});
  const make=(type,timerId='t1',payload={})=>({type,timerId,payload,commandId:crypto.randomUUID(),sequence:++sequence});
  const command=c=>request('/command',{...c,deviceId:'smoke-xl'});
  const state=()=>js('deckControl.model.snapshot()');
  const displays=await js('api.getDisplays()'),twoDisplays=displays.length>=2;
  await js(`S.running=false;S.mode='countdown';S.dualTimer=true;S.separateOutputs=${twoDisplays};S.liveTimerView='both';S.deckLiveMode='window';S.secondary=TimerTools.secondary();syncDualUI();setDuration(600000);startPause();`);
  const before=await js('({endAt:S.endAt,second:JSON.stringify(S.secondary)})');
  assert.equal((await command(make('preset','t1',{durationMs:900000}))).ok,true);
  assert.equal((await command(make('adjust','t1',{step:1,unit:'m',target:'set'}))).ok,true);
  assert.deepEqual(await js('({endAt:S.endAt,second:JSON.stringify(S.secondary)})'),before);
  assert.equal((await state()).timers.t1.draft.durationMs,960000);
  console.log('DECK_ACTIVE_SET_ISOLATION_OK=true');
  let snapshot=await state();
  const replace={...make('startSet'),expectedActiveVersion:snapshot.timers.t1.active.version,expectedDraftVersion:snapshot.timers.t1.draft.version};
  assert.equal((await command(replace)).ok,true);const deadline=await js('S.endAt');
  assert.equal((await command(replace)).ok,true);assert.equal(await js('S.endAt'),deadline);
  assert.equal(await js('S.durationMs'),960000);
  console.log('DECK_ATOMIC_ONE_TOUCH_START_SET_OK=true');
  assert.equal((await command(make('enterTime','t2'))).ok,true);
  for(const digit of [0,1,2,3,4,5])assert.equal((await command(make('numericDigit','t2',{digit}))).ok,true);
  assert.equal((await command(make('numericApply','t2'))).ok,true);
  snapshot=await state();assert.equal(snapshot.timers.t2.draft.durationMs,5025000);
  assert.equal(await js('S.endAt'),deadline);
  assert.equal((await command({...make('startSet','t2'),expectedActiveVersion:snapshot.timers.t2.active.version,expectedDraftVersion:snapshot.timers.t2.draft.version})).ok,true);
  assert.equal(await js('S.secondary.durationMs'),5025000);
  assert.equal(await js('S.endAt'),deadline);
  console.log('DECK_NUMERIC_T2_012345_OK=true');
  assert.equal((await command(make('countup','t2'))).ok,true);
  assert.equal(await js('S.secondary.mode'),'countdown','SET mode must not change ACTIVE');
  const modes=await js(`(async()=>{
    const start=()=>{const s=deckControl.model.snapshot();return{type:'startSet',timerId:'t2',commandId:crypto.randomUUID(),expectedActiveVersion:s.timers.t2.active.version,expectedDraftVersion:s.timers.t2.draft.version};};
    let c=start();await deckControl.execute(c);let result=await deckControl.execute(c);
    const countup=result.ok&&S.secondary.mode==='countup'&&S.secondary.running;
    await deckControl.execute({type:'clock',timerId:'t2'});c=start();await deckControl.execute(c);result=await deckControl.execute(c);
    return {countup,clock:result.ok&&S.secondary.mode==='clock'&&!S.secondary.running};
  })()`);
  assert.deepEqual(modes,{countup:true,clock:true});assert.equal(await js('S.endAt'),deadline);
  console.log('DECK_T2_COUNTUP_CLOCK_OK=true');
  const clocksBeforeBlack=await js('({t1:S.endAt,t2:JSON.stringify(S.secondary)})');
  for(const type of ['blackoutOn','blackoutOn','blackoutOff','blackoutOff']){
    assert.equal((await command(make(type))).ok,true);
    assert.equal(await js('S.blackout'),type==='blackoutOn');
    assert.deepEqual(await js('({t1:S.endAt,t2:JSON.stringify(S.secondary)})'),clocksBeforeBlack,'explicit BLACK/RESTORE never mutates clocks');
  }
  console.log('DECK_EXPLICIT_BLACK_RESTORE_OK=true');
  for(const type of ['liveT1','liveBoth','liveT2','liveBoth']){
    const live=await command(make(type));assert.equal(live.ok,true,JSON.stringify(live));
    assert.equal(await js('S.liveTimerView'),{liveT1:'t1',liveT2:'t2',liveBoth:'both'}[type]);
    assert.deepEqual(await js('({t1:S.endAt,t2:JSON.stringify(S.secondary)})'),clocksBeforeBlack);
  }
  assert.ok(getOutput());if(twoDisplays)assert.ok(getSecondary());
  assert.equal(getOutput().isFullScreen(),false);if(twoDisplays)assert.equal(getSecondary().isFullScreen(),false);
  for(const type of ['blackoutOn','blackoutOff']){
    assert.equal((await command(make(type))).ok,true);
    await delay(80);
    for(const win of [getOutput(),getSecondary()].filter(Boolean))assert.equal(await win.webContents.executeJavaScript("$('blackout').style.display"),type==='blackoutOn'?'block':'none');
  }
  snapshot=await state();
  assert.equal((await command({...make('loadSet','t1'),expectedActiveVersion:snapshot.timers.t1.active.version,expectedDraftVersion:snapshot.timers.t1.draft.version})).code,'ACTIVE_RUNNING');
  await command(make('pause','t1'));snapshot=await state();
  const t2BeforeLoad=await js('JSON.stringify(S.secondary)');
  assert.equal((await command({...make('loadSet','t1'),expectedActiveVersion:snapshot.timers.t1.active.version,expectedDraftVersion:snapshot.timers.t1.draft.version})).ok,true);
  assert.equal(await js('S.running'),false);assert.equal(await js('S.remMs'),960000);assert.equal(await js('JSON.stringify(S.secondary)'),t2BeforeLoad);
  assert.equal((await command(make('start','t1'))).ok,true,'PLAY ACTIVE must start a READY loaded timer');
  console.log('DECK_LOAD_READY_AND_LIVE_VIEWS_OK=true');
  // Exercise every adjustment and preset key on BOTH targets using real renderer
  // clocks. The compiled SDK adapter separately exercises physical event mapping.
  for(const timerId of ['t1','t2']){
    assert.equal((await command(make('selectTimer',timerId,{timerId}))).ok,true);
    const activeBefore=await js('({t1:S.endAt,t2:JSON.stringify(S.secondary)})');
    for(const minutes of [5,10,15,30,60]){
      assert.equal((await command(make('preset',timerId,{durationMs:minutes*60000}))).ok,true);
      assert.equal((await state()).timers[timerId].draft.durationMs,minutes*60000);
    }
    for(const unit of ['h','m','s'])for(const step of [-1,1]){
      const beforeDraft=(await state()).timers[timerId].draft.durationMs;
      assert.equal((await command(make('adjust',timerId,{unit,step,target:'set'}))).ok,true);
      assert.equal((await state()).timers[timerId].draft.durationMs,Math.max(0,beforeDraft+step*{h:3600000,m:60000,s:1000}[unit]));
    }
    assert.deepEqual(await js('({t1:S.endAt,t2:JSON.stringify(S.secondary)})'),activeBefore);
    assert.equal((await command(make('clearSet',timerId))).ok,true);
    assert.equal((await state()).timers[timerId].draft.durationMs,0);
  }
  console.log('DECK_ALL_SIX_ADJUSTMENTS_FIVE_PRESETS_BOTH_TARGETS_OK=true');
  if(twoDisplays){
    await js("S.deckLiveMode='fullscreen';send();");
    for(const type of ['liveBoth','liveT1','liveT2','liveBoth']){
      const result=await command(make(type));assert.equal(result.ok,true,JSON.stringify(result));
      if(type!=='liveT2')assert.equal(isFullscreen(getOutput()),true);
      else assert.equal(getOutput(),null);
      if(type!=='liveT1')assert.equal(isFullscreen(getSecondary()),true);
      else assert.equal(getSecondary(),null);
    }
    console.log('DECK_SEPARATE_LIVE_FULLSCREEN_CLOSE_EXCLUDED_OK=true');
  }else console.log('DECK_SEPARATE_FULLSCREEN_SKIPPED=requires_two_connected_displays');
  // Combined LIVE is a single real output with the configured split. Explicit
  // fullscreen is independent of a saved window size and a previous BLACK ON.
  await js("S.separateOutputs=false;S.dualSplit='rows';S.deckLiveMode='fullscreen';syncDualUI();send();");
  assert.equal((await command(make('blackoutOn'))).ok,true);
  for(const type of ['liveT1','liveBoth','liveT2']){
    const result=await command(make(type));assert.equal(result.ok,true,JSON.stringify(result));
    assert.equal(isFullscreen(getOutput()),true);assert.equal(await js('S.blackout'),false);
    await delay(80);
    const shown=await getOutput().webContents.executeJavaScript('({dual:S.dualTimer,mode:S.mode,split:S.dualSplit,duration:S.durationMs})');
    assert.equal(shown.dual,type==='liveBoth');
    if(type==='liveBoth')assert.equal(shown.split,'rows');
    if(type==='liveT2')assert.equal(shown.mode,'clock');
  }
  console.log('DECK_LIVE_SEND_FULLSCREEN_SPLIT_T2_AND_BLACK_OFF_OK=true');
  await js("S.separateOutputs=true;S.liveTimerView='both';S.deckLiveMode='window';syncDualUI();send();");
  const reset=await command(make('reset','t2'));assert.equal(reset.ok,true);assert.equal(await js('S.secondary.running'),false);
  await deckHost.bridge.close();const activeDeadline=await js('S.endAt');await delay(600);
  assert.equal(await js('S.endAt'),activeDeadline);assert.equal((await state()).editTarget,'set');
  console.log('DECK_DISCONNECT_NO_REPLAY_OK=true');
  await require('./smoke-deck-ui')({controlWin});
  const original=await js('JSON.stringify(S)');
  await js('deckControl.ui.openEditor()');await delay(150);
  assert.equal(await js('document.querySelectorAll(".pt-deck-dialog .pt-deck-key").length'),32);
  assert.equal(await js('JSON.stringify(S)'),original,'Opening editor never changes the engine');
  const image=path.join(os.tmpdir(),'protimer-stream-deck-editor.png');
  fs.writeFileSync(image,(await controlWin.webContents.capturePage()).toPNG());
  console.log('DECK_EDITOR_SCREENSHOT='+image);
  await js("document.querySelector('.pt-deck-dialog').dispatchEvent(new Event('cancel',{cancelable:true}))");
  // Same code path used by a key, applied ACK only after a real output exists.
  const out=await js("applyDeckOperation({type:'outputB',timerId:'t2',action:'open'})");assert.equal(out.ok,true);
  assert.ok(getSecondary());assert.equal(await js('S.endAt'),activeDeadline);
  assert.equal((await js("applyDeckOperation({type:'outputB',timerId:'t2',action:'close'})")).ok,true);
  assert.equal(getSecondary(),null);
  console.log('DECK_REAL_OUTPUT_ADAPTER_OK=true');
  await js(`Object.assign(S,${JSON.stringify(base.s)});cues=${JSON.stringify(base.cues)};syncDualUI();send();updateButtons();renderCues();`);
  console.log('DECK_SMOKE_OK=true');
};
