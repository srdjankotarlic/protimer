'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Only invoked with the existing isolated --smoke userData. Exercise the real
// renderer and output IPC; intercept final playback to avoid sounding an alarm.
module.exports = async function smokeAlerts({controlWin,getOutput,getSecondary,displayId}) {
  const ctl = code => controlWin.webContents.executeJavaScript(code);
  async function waitFor(predicate) { for(let i=0;i<100;i++){if(await predicate())return;await delay(30);}throw Error('Alert smoke timed out'); }
  await waitFor(()=>ctl('!!deckControl'));
  const saved = await ctl('({s:JSON.parse(JSON.stringify(S)),autoNext,zeroFired,lang,settings:localStorage.getItem("pt_settings")})');
  const bounds=controlWin.getBounds();
  let checks=0;
  function check(name,value){assert.ok(value,name);checks++;console.log(name+'=true');}
  try {
    await ctl(`window.__alertPlay=bellAudio.play; window.__alertCalls=0;
      bellAudio.play=async()=>{window.__alertCalls++;return {ok:true};};
      autoNext=false;cancelAutoAdvance();S.dualTimer=true;S.separateOutputs=false;
      S.gridOn=false;S.secondary.gridOn=false;S.blackout=false;S.text='';S.textOnly=false;S.message={text:'',flash:false};
      S.transparent=false;S.outputSize={width:640,height:360};S.secondary.outputSize={width:480,height:270};
      S.useWarnColors=false;S.warnRed='#ff4540';S.overtime=true;S.secondary.overtime=true;syncDualUI();`);
    const setup = async (a,b) => ctl(`S.soundZero=${a};S.secondary.soundZero=${b};
      setDuration(10000);secondaryDuration(10000);bothRunning(true);window.__alertCalls=0;`);
    const expire = async (which) => ctl(`${which.map(id=>(id==='t1'?'S':'S.secondary')+'.endAt=Date.now()-20;').join('')}send();tickCountdown();`);
    await setup(true,false);await expire(['t1','t2']);
    check('ALERT_T1_ONLY_ONCE',await ctl('window.__alertCalls===1'));
    await ctl('tickCountdown();tickCountdown();send();');
    check('ALERT_REPEATED_TICK_NO_DUPLICATE',await ctl('window.__alertCalls===1'));
    await setup(false,true);await expire(['t1','t2']);
    check('ALERT_T2_ONLY_ONCE',await ctl('window.__alertCalls===1'));
    await setup(false,false);await expire(['t1','t2']);
    check('ALERT_BOTH_OFF_SILENT',await ctl('window.__alertCalls===0'));
    await ctl(`for(const id of ['chkSound','chkSound2']){$(id).checked=true;$(id).dispatchEvent(new Event('change'));}tickCountdown();`);
    check('ALERT_ENABLE_AFTER_ZERO_NO_LATE_BELL',await ctl('window.__alertCalls===0'));
    await ctl('bothRunning(false);bothRunning(true);tickCountdown();');
    check('ALERT_RESUME_OVERTIME_NO_REPLAY',await ctl('window.__alertCalls===0'));
    await setup(true,true);await expire(['t1','t2']);
    check('ALERT_SIMULTANEOUS_NO_OVERLAP',await ctl('window.__alertCalls===1'));
    await ctl('setDuration(10000);secondaryDuration(10000);bothRunning(true);');await expire(['t2']);
    check('ALERT_NEW_COUNTDOWN_REARMS',await ctl('window.__alertCalls===2'));
    const stable=await ctl(`(()=>{const before=[S.endAt,S.secondary.endAt,S.running,S.secondary.running];
      for(const id of ['chkFlash','chkFlash2']){$(id).checked=false;$(id).dispatchEvent(new Event('change'));}
      return JSON.stringify(before)===JSON.stringify([S.endAt,S.secondary.endAt,S.running,S.secondary.running]);})()`);
    check('ALERT_SWITCHES_KEEP_TIMER_DEADLINES',stable);
    await ctl(`S.running=false;S.remMs=-5000;S.secondary.running=false;S.secondary.remMs=-3000;send();`);
    await delay(80);
    check('ALERT_CONTROL_STEADY_RED',await ctl(`!$('pvTime').classList.contains('blink')&&!$('secondaryReadout').classList.contains('blink')&&getComputedStyle($('pvTime')).color==='rgb(255, 69, 64)'&&getComputedStyle($('secondaryReadout')).color==='rgb(255, 69, 64)'`));
    await ctl(`api.sendToDisplay(${displayId});`);
    await waitFor(()=>getOutput()&&!getOutput().webContents.isLoading());
    const output=code=>getOutput().webContents.executeJavaScript(code);
    await waitFor(()=>output(`!!S&&S.remMs===-5000&&S.dualTimer`));
    await waitFor(()=>output(`$('timer').textContent==='−0:05'&&$('secondaryTimer').textContent==='−0:03'`));
    check('ALERT_COMBINED_STEADY_RED',await output(`['timer','secondaryTimer'].every(id=>getComputedStyle($(id)).animationName==='none'&&getComputedStyle($(id)).color==='rgb(255, 69, 64)')`));
    await ctl(`$('chkOver2').checked=false;$('chkOver2').dispatchEvent(new Event('change'));render();`);
    await waitFor(()=>output(`$('timer').textContent==='−0:05'&&$('secondaryTimer').textContent==='0:00'`));
    check('OVERTIME_T1_MINUS_T2_ZERO_CONTROL',await ctl(`$('pvTime').textContent==='−0:05'&&$('secondaryReadout').textContent==='0:00'&&S.overtime&&!S.secondary.overtime`));
    check('OVERTIME_T1_MINUS_T2_ZERO_COMBINED',await output(`getComputedStyle($('secondaryTimer')).color==='rgb(255, 69, 64)'`));
    await ctl(`$('chkOver').checked=false;$('chkOver').dispatchEvent(new Event('change'));$('chkOver2').checked=true;$('chkOver2').dispatchEvent(new Event('change'));render();`);
    await waitFor(()=>output(`$('timer').textContent==='0:00'&&$('secondaryTimer').textContent==='−0:03'`));
    check('OVERTIME_T1_ZERO_T2_MINUS_CONTROL',await ctl(`$('pvTime').textContent==='0:00'&&$('secondaryReadout').textContent==='−0:03'&&!S.overtime&&S.secondary.overtime`));
    check('OVERTIME_T1_ZERO_T2_MINUS_COMBINED',await output(`getComputedStyle($('timer')).color==='rgb(255, 69, 64)'`));
    await ctl(`$('chkFlash2').checked=true;$('chkFlash2').dispatchEvent(new Event('change'));`);
    await waitFor(()=>output(`$('secondaryTimer').classList.contains('blink')`));
    check('ALERT_T2_BLINK_INDEPENDENT',await output(`!$('timer').classList.contains('blink')&&$('secondaryTimer').classList.contains('blink')`));
    await ctl(`S.separateOutputs=true;syncDualUI();send();api.openSecondaryOutput(${displayId});`);
    await waitFor(()=>getSecondary()&&!getSecondary().webContents.isLoading());
    const secondary=code=>getSecondary().webContents.executeJavaScript(code);
    await waitFor(()=>secondary(`!!S&&S.remMs===-3000&&$('timer').classList.contains('blink')`));
    check('ALERT_SEPARATE_T2_OWN_FLAG',await secondary(`S.flashZero===true&&S.soundZero===true`));
    check('OVERTIME_SEPARATE_T2_MINUS_WITH_T1_ZERO',await secondary(`S.overtime&&$('timer').textContent==='−0:03'`));
    await ctl(`$('chkOver2').checked=false;$('chkOver2').dispatchEvent(new Event('change'));`);
    await waitFor(()=>secondary(`!S.overtime&&$('timer').textContent==='0:00'`));
    check('OVERTIME_SEPARATE_T2_HOLDS_ZERO',await secondary(`getComputedStyle($('timer')).color==='rgb(255, 69, 64)'`));
    await ctl(`$('chkFlash2').checked=false;$('chkFlash2').dispatchEvent(new Event('change'));`);
    await waitFor(()=>secondary(`!$('timer').classList.contains('blink')`));
    check('ALERT_T2_DISABLE_STOPS_IMMEDIATELY',await secondary(`getComputedStyle($('timer')).animationName==='none'&&getComputedStyle($('timer')).color==='rgb(255, 69, 64)'`));
    await ctl(`S.overtime=false;S.flashZero=false;S.secondary.flashZero=false;send();`);
    await waitFor(()=>output('!!S&&!S.overtime'));
    await waitFor(()=>output(`$('timer').textContent==='0:00'`));
    check('ALERT_ZERO_WITHOUT_MINUS_STAYS_RED',await output(`$('timer').textContent==='0:00'&&getComputedStyle($('timer')).color==='rgb(255, 69, 64)'&&!$('timer').classList.contains('blink')`));
    await ctl(`S.overtime=true;S.secondary.overtime=false;S.flashZero=false;S.soundZero=true;S.secondary.flashZero=true;S.secondary.soundZero=false;saveSettings();
      S.overtime=false;S.secondary.overtime=true;S.flashZero=true;S.soundZero=false;S.secondary.flashZero=false;S.secondary.soundZero=true;load();send();`);
    check('ALERT_SETTINGS_RESTORE_INDEPENDENTLY',await ctl(`!S.flashZero&&S.soundZero&&S.secondary.flashZero&&!S.secondary.soundZero&&!$('chkFlash').checked&&$('chkSound').checked&&$('chkFlash2').checked&&!$('chkSound2').checked&&!S.running&&!S.secondary.running`));
    check('OVERTIME_SETTINGS_RESTORE_INDEPENDENTLY',await ctl(`S.overtime&&!S.secondary.overtime&&$('chkOver').checked&&!$('chkOver2').checked`));
    // Countdown clocks and bell crossings keep running authoritatively. Holding
    // zero is a display choice; switching it never rewrites a live deadline.
    await setup(true,true);
    const overtimeStable=await ctl(`(()=>{const before=[S.endAt,S.secondary.endAt,S.running,S.secondary.running];
      for(const id of ['chkOver','chkOver2']){$(id).checked=false;$(id).dispatchEvent(new Event('change'));}
      return JSON.stringify(before)===JSON.stringify([S.endAt,S.secondary.endAt,S.running,S.secondary.running]);})()`);
    check('OVERTIME_SWITCHES_KEEP_LIVE_DEADLINES',overtimeStable);
    await expire(['t1','t2']);await ctl('render();');
    check('OVERTIME_ZERO_HOLD_STILL_BELLS_ONCE',await ctl(`window.__alertCalls===1&&$('pvTime').textContent==='0:00'&&$('secondaryReadout').textContent==='0:00'`));
    await ctl('bothRunning(false);');
    await ctl(`S.dualTimer=false;syncDualUI();send();`);
    check('ALERT_T2_CONTROLS_HIDDEN_WHEN_UNUSED',await ctl(`$('secondaryZeroAlerts').hidden`));
    await ctl(`S.soundZero=false;S.secondary.soundZero=false;window.__alertCalls=0;$('btnTestZeroBell').click();`);
    check('ALERT_MANUAL_TEST_DOES_NOT_ENABLE_AUTO',await ctl(`window.__alertCalls===1&&!S.soundZero&&!S.secondary.soundZero`));
    for(const language of ['sr','en']){
      await ctl(`lang='${language}';applyLang();S.dualTimer=true;syncDualUI();`);
      for(const width of [820,1120]){
        controlWin.setBounds({...bounds,width,height:740});await delay(100);
        check(`ALERT_REFLOW_${language}_${width}`,await ctl(`(()=>{const p=$('zeroAlertsPanel'),r=p.getBoundingClientRect();return p.scrollWidth<=p.clientWidth+2&&Array.from(p.querySelectorAll('button,input')).every(e=>{const b=e.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right+1;});})()`));
      }
    }
    await ctl(`lang='sr';applyLang();$('zeroAlertsPanel').scrollIntoView({block:'center'});`);
    await delay(100);
    const screenshot=path.join(os.tmpdir(),'protimer-zero-alerts.png');
    fs.writeFileSync(screenshot,(await controlWin.webContents.capturePage()).toPNG());
    console.log('ALERT_SCREENSHOT='+screenshot);
    // Real Electron Web Audio, deliberately muted: verifies synthesis/routing
    // can start without a keyboard gesture, not that physical speakers are audible.
    const audio=await ctl(`(async()=>{bellAudio.play=window.__alertPlay;return Promise.race([
      bellAudio.play({sound:'builtin',sinkId:'default',volume:0}),
      new Promise(resolve=>setTimeout(()=>resolve({ok:false,code:'AUDIO_START_TIMEOUT'}),3000))]);})()`);
    if(!audio.ok)console.log('ALERT_AUDIO_START_RESULT='+JSON.stringify(audio));
    check('ALERT_REAL_AUDIO_MUTED_START',audio.ok);
    console.log('ALERT_SMOKE_CHECKS='+checks);
    console.log('ALERT_SMOKE_OK=true');
  } finally {
    await ctl(`bellAudio.play=window.__alertPlay;delete window.__alertPlay;delete window.__alertCalls;
      S=${JSON.stringify(saved.s)};autoNext=${JSON.stringify(saved.autoNext)};zeroFired=${JSON.stringify(saved.zeroFired)};lang=${JSON.stringify(saved.lang)};
      syncDualUI();applyLang();send();
      ${saved.settings===null?'localStorage.removeItem("pt_settings");':'localStorage.setItem("pt_settings",'+JSON.stringify(saved.settings)+');'}`);
    controlWin.setBounds(bounds);
  }
};
