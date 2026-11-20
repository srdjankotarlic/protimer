'use strict';
const assert=require('node:assert/strict');
const { BrowserWindow }=require('electron');

module.exports=async function({controlWin,getOutput,screen,serverPort,token}){
  const ctl=code=>controlWin.webContents.executeJavaScript(code);
  const out=code=>getOutput().webContents.executeJavaScript(code);
  const host=screen.getDisplayMatching(controlWin.getBounds());
  const wait=async(probe,message)=>{
    const end=Date.now()+5000;
    while(!await probe()){assert.ok(Date.now()<end,message);await new Promise(r=>setTimeout(r,30));}
  };
  const t1='({mode:S.mode,duration:S.durationMs,end:S.endAt,running:S.running,rem:S.remMs,cue:currentCue})';
  const t2='({mode:S.secondary.mode,duration:S.secondary.durationMs,end:S.secondary.endAt,running:S.secondary.running,rem:S.secondary.remMs,elapsed:S.secondary.elapsedMs})';
  const click=selector=>ctl(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const mode=value=>click(`[data-mode-secondary="${value}"]`);
  await ctl(`api.closeSecondaryOutput();api.closeOutput();bothRunning(false);
    S.dualTimer=true;S.separateOutputs=false;S.dualSplit='rows';S.liveTimerView='both';S.freeAudience=false;S.freeLayout=null;
    S.gridOn=false;S.fitWindow=false;S.transparent=false;S.blackout=false;S.text='';S.textOnly=false;
    S.soundZero=false;S.secondary.soundZero=false;S.outputLayer='normal';S.outputSize={width:800,height:500};
    setDuration(600000);secondaryDuration(240000);syncDualUI();send();
    $('btnStart').click();api.sendToDisplay(${host.id});`);
  await wait(()=>getOutput()?.isVisible(),'Audience output did not open');
  const primary=await ctl(t1);
  assert.equal(primary.running,true);
  await click('#btnSecondaryStart');
  const secondary=await ctl(t2);
  assert.equal(secondary.running,true);
  for(const [step,expected] of [[60,60000],[-10,50000],[300,350000],[-300,50000],[-60,-10000],[10,0]]){
    await click(`[data-adj-secondary="${step}"]`);
    const current=await ctl(t2);
    assert.equal(current.end,secondary.end+expected);
    assert.equal(current.duration,secondary.duration+expected);
    assert.equal(current.running,true);
    assert.deepEqual(await ctl(t1),primary);
  }
  await click('#btnSecondaryStart');
  assert.equal((await ctl(t2)).running,false);
  await click('#btnSecondaryReset');
  assert.equal((await ctl(t2)).rem,240000);
  await click('#secondaryChips button:nth-child(4)');
  assert.equal((await ctl(t2)).duration,300000);
  await click('#btnSetSecondaryDur');
  await ctl(`$('durationHours').value=0;$('durationMinutes').value=7;$('durationSeconds').value=9;$('durationPickerConfirm').click()`);
  assert.equal((await ctl(t2)).duration,429000);
  await mode('countup');
  await click('#btnSecondaryStart');
  await wait(()=>out(`S?.secondary?.mode==='countup'&&S.secondary.running&&$('secondaryTimer').textContent!=='0:00'`),'Stopwatch did not count up on audience screen');
  await click('#btnSecondaryStart');
  assert.ok((await ctl(t2)).elapsed>=1000);
  await click('#btnSecondaryReset');
  assert.equal((await ctl(t2)).elapsed,0);
  await mode('clock');
  await wait(()=>ctl(`$('btnSecondaryStart').disabled&&document.querySelector('[data-mode-secondary="clock"]').getAttribute('aria-pressed')==='true'&&document.querySelector('[data-adj-secondary="60"]').disabled`),'Clock controls did not synchronize');
  await wait(()=>out(`S?.secondary?.mode==='clock'&&/^[0-9]{2}:[0-9]{2}:[0-9]{2}$/.test($('secondaryTimer').textContent)`),'Clock did not render on the audience screen');
  assert.deepEqual(await ctl(t1),primary);

  // Check real Chromium font decoding in both delivery paths, including
  // all digit shapes, the overtime minus and worst-case long times.
  const digitFonts=['default','pixel','cyber','condensed','plex','space','bold','geist','serif','lexend'];
  assert.deepEqual(await ctl(`Array.from($('digitFont').options,o=>o.value)`),digitFonts);
  const selectFont=id=>ctl(`$('digitFont').value=${JSON.stringify(id)};$('digitFont').dispatchEvent(new Event('change'))`);
  const probeFont=(id,targets)=>`(async()=>{
    const family='ProTimer '+${JSON.stringify(id)}, sample='−88:88:88';
    const advance=TimerTools.digitWidth(${JSON.stringify(id)},sample);
    const faces=await document.fonts.load('700 100px "'+family+'"',sample+'0123456789');
    const el=document.createElement('span');
    el.style.cssText='position:absolute;visibility:hidden;white-space:nowrap;font:700 100px "'+family+'";font-variant-numeric:tabular-nums';
    el.textContent=sample;document.body.append(el);
    const measured=el.getBoundingClientRect().width;el.remove();
    return faces.length===1&&faces[0].status==='loaded'&&measured<=advance*100+1
      &&${JSON.stringify(targets)}.every(id=>getComputedStyle($(id)).fontFamily.includes(family));
  })()`;
  const viewer=new BrowserWindow({width:390,height:844,show:false,webPreferences:{backgroundThrottling:false}});
  try {
    await viewer.loadURL(`http://127.0.0.1:${serverPort}/`);
    const read=code=>viewer.webContents.executeJavaScript(code);
    for(const id of digitFonts.slice(1)){
      await selectFont(id);
      const hasFont=`S?.digitFont===${JSON.stringify(id)}`;
      await wait(async()=>await out(hasFont)&&await read(hasFont),`Font ${id} did not reach audience state`);
      assert.equal(await ctl(probeFont(id,['pvTime','secondaryReadout','digitFontSample'])),true,`Controller font ${id}`);
      assert.equal(await out(probeFont(id,['timer','secondaryTimer'])),true,`Desktop font ${id}`);
      assert.equal(await read(probeFont(id,['timer','secondaryTimer'])),true,`Browser font ${id}`);
    }
    await selectFont('cyber');
    for(const [url,targets] of [[`/remote?t=${encodeURIComponent(token)}`,['time','secondaryTime']],['/backstage',['nowTimer']]]){
      await viewer.loadURL(`http://127.0.0.1:${serverPort}${url}`);
      await wait(()=>read(`S?.digitFont==='cyber'`),`Font did not reach ${url.split('?')[0]}`);
      assert.equal(await read(probeFont('cyber',targets)),true);
    }
    await selectFont('default');
    await wait(()=>out(`S?.digitFont==='default'&&!$('timer').style.fontFamily&&!$('secondaryTimer').style.fontFamily`),'Default output font did not return');
    assert.equal(await ctl(`!$('pvTime').style.fontFamily&&!$('secondaryReadout').style.fontFamily`),true);
    assert.deepEqual(await ctl(t1),primary);
    await selectFont('pixel');
  } finally {
    viewer.destroy();
  }

  // Both tickets together: a running countdown stays at the top, the clock
  // is placed freely lower down, and moving either never changes either clock.
  const beforeLayout=await ctl(t2);
  await ctl(`$('chkFreeAudience').click();
    function changeComponent(key,value){$('layoutTarget').value=key;$('layoutTarget').dispatchEvent(new Event('change'));$('timerYValue').value=value;$('timerYValue').dispatchEvent(new Event('input'));}
    changeComponent('primary',-44);changeComponent('secondary',48);`);
  await wait(()=>out(`document.body.classList.contains('free-audience')&&$('timer').style.top==='28%'&&$('secondaryTimer').style.top==='74%'&&S.running&&S.secondary.mode==='clock'`),'Countdown and clock do not share the free audience canvas');
  assert.deepEqual(await ctl(t1),primary);
  assert.deepEqual(await ctl(t2),beforeLayout);

  await ctl(`const future=new Date(engineClock.sample()+10*60000);
    $('secondaryTargetInput').value=pad(future.getHours())+':'+pad(future.getMinutes());
    $('secondaryTargetInput').dispatchEvent(new Event('change'));render();`);
  assert.equal(await ctl(`S.secondary.mode==='countdown'&&secondaryTargetArmed`),true);
  await click('#btnSecondaryStart');
  assert.equal(await ctl(`!secondaryTargetArmed&&S.secondary.running&&new Date(S.secondary.endAt).getSeconds()===0&&S.secondary.endAt-Date.now()>8*60000`),true);
  await ctl(`$('chkOver2').click();$('chkFlash2').click();$('chkSound2').click();
    $('btnSecondaryBlackout').click();render();`);
  await wait(()=>out(`$('blackout').style.display==='block'`),'T2 shared blackout did not reach output');
  assert.equal(await ctl(`document.querySelector('#timerOneControls #chkOver')&&document.querySelector('#timerTwoControls #chkOver2')&&$('yellowInput').closest('.panel')===$('warnYellow').closest('.panel')&&$('redInput').closest('.panel')===$('warnRed').closest('.panel')&&$('btnBlackout').classList.contains('on')&&$('btnSecondaryBlackout').getAttribute('aria-pressed')==='true'`),true);
  await click('#btnSecondaryBlackout');
  await wait(()=>out(`$('blackout').style.display==='none'`),'Shared blackout did not clear');
  assert.deepEqual(await ctl(t1),primary);

  await ctl(`$('zeroAlertsPanel').open=true;document.querySelectorAll('.timer-alerts').forEach(panel=>panel.open=true);`);
  const size=controlWin.getContentSize();
  for(const width of [820,1120]){
    controlWin.setContentSize(width,740);
    for(const language of ['sr','en']){
      await ctl(`lang='${language}';applyLang();`);
      assert.equal(await ctl(`['timerOneControls','timerTwoControls','zeroAlertsPanel'].every(id=>{const p=$(id),r=p.getBoundingClientRect();return p.scrollWidth<=p.clientWidth+2&&[...p.querySelectorAll('button,input')].every(e=>{const b=e.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1;});})`),true,`Controls clipped at ${width} ${language}`);
    }
  }
  controlWin.setContentSize(...size);
  await mode('clock');
  const saved=await ctl(`[S.secondary.overtime,S.secondary.flashZero,S.secondary.soundZero,S.freeAudience,S.digitFont]`);
  await ctl('api.closeOutput()');
  await wait(()=>!getOutput(),'Audience window did not close');
  await new Promise(resolve=>{controlWin.webContents.once('did-finish-load',resolve);controlWin.webContents.reload();});
  const restored=await ctl(`[S.secondary.overtime,S.secondary.flashZero,S.secondary.soundZero,S.freeAudience,S.digitFont]`);
  assert.deepEqual(restored,saved);
  assert.equal(await ctl(`S.secondary.mode==='clock'&&!S.running&&!S.secondary.running&&!secondaryTargetArmed`),true);
  assert.equal(getOutput(),null);
  assert.equal(await ctl(`$('digitFont').value==='pixel'&&$('digitFontSample').style.fontFamily.includes('ProTimer pixel')`),true);
  await selectFont('default');
  console.log('TIMER_DIGIT_FONTS_OK=true');
  console.log('TIMER2_PARITY_AND_FREE_LAYOUT_OK=true');
};
