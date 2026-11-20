'use strict';
const assert=require('node:assert/strict');
const { BrowserWindow }=require('electron');

module.exports=async function({controlWin,screen}){
  const ctl=code=>controlWin.webContents.executeJavaScript(code);
  const delay=()=>new Promise(resolve=>setTimeout(resolve,35));
  async function wait(probe,message){
    const until=Date.now()+6500;
    do{if(await probe()) return;await delay();}while(Date.now()<until);
    throw Error(message);
  }
  const display=screen.getDisplayMatching(controlWin.getBounds());
  const windowFor=()=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('output.html?routed=1'));
  const out=code=>windowFor().webContents.executeJavaScript(code);
  const incoming=await ctl(`api.getDisplays().then(screens=>screens.find(d=>d.id===${display.id}))`);
  const route={displayId:display.id,label:incoming.label,view:'both',background:'green',presentation:'fullscreen'};
  const send=changes=>ctl(`api.applyRoutedOutputs([${JSON.stringify({...route,...changes})}])`);
  await ctl(`api.closeOutput();api.closeSecondaryOutput();api.closeRoutedOutputs();
    S.dualTimer=true;S.dualSplit='columns';S.liveTimerView='t2';S.freeAudience=false;
    S.outputLayout=TimerTools.layout();S.secondary.layout=TimerTools.layout();
    S.transparent=true;S.text='SHOULD BE HIDDEN';S.textOnly=true;
    S.message={text:'HIDE MESSAGE',flash:false};S.showProgress=true;S.showNowNext=true;
    S.soundZero=false;S.secondary.soundZero=false;S.blackout=false;
    setDuration(600000);secondaryDuration(240000);bothRunning(true);syncDualUI();send();`);
  const clocks=()=>ctl(`[S.endAt,S.secondary.endAt,S.running,S.secondary.running]`);
  const before=await clocks();
  assert.equal(windowFor(),undefined);
  try{
    assert.equal((await send({})).ok,true);
    await wait(()=>windowFor()?.isVisible(),'Routed fullscreen did not open');
    await wait(()=>out(`S?.outputKeyColor==='#00ff00'&&$('stage').classList.contains('dual')&&isFS`),'Both timers did not render');
    assert.deepEqual(windowFor().getBounds(),display.bounds);
    assert.equal(await out(`['text','msg','prog','nownext'].every(id=>getComputedStyle($(id)).display==='none')
      &&getComputedStyle($('timer')).color==='rgb(255, 255, 255)'
      &&getComputedStyle($('secondaryTimer')).color==='rgb(255, 255, 255)'
      &&getComputedStyle($('secondaryPane')).boxShadow==='none'`),true);
    const win=windowFor();
    const pixel=async()=>{
      const image=await win.webContents.capturePage({x:1,y:1,width:1,height:1});
      assert.ok(!image.isEmpty(),'Keying capture unavailable');
      return [...image.toBitmap().subarray(0,4)]; // BGRA
    };
    async function assertPixel(expected){
      // State changes arrive before the compositor publishes its next surface.
      // The display color profile can also round saturated channels slightly.
      let actual;
      try{
        await wait(async()=>{
          actual=await pixel();
          return actual.slice(0,3).every((channel,i)=>Math.abs(channel-expected[i])<=3)&&actual[3]===255;
        },`Keying pixels did not update to ${expected}`);
      }catch(error){
        throw new Error(`${error.message}; last captured BGRA ${actual}`,{cause:error});
      }
    }
    await assertPixel([0,255,0,255]);
    await ctl('S.blackout=true;send()');
    await wait(()=>out(`document.body.classList.contains('foreground-hidden')&&$('blackout').style.display==='none'`),'BLACKOUT did not hide only foreground');
    await assertPixel([0,255,0,255]);
    await ctl('S.blackout=false;send()');

    for(const [view,background,expected] of [['t1','luma',600000],['t2','blue',240000]]){
      assert.equal((await send({view,background})).ok,true);
      await wait(()=>out(`!S.dualTimer&&S.durationMs===${expected}&&S.outputKeyColor===${JSON.stringify(background==='blue'?'#0000ff':'#000000')}`),'Wrong solo timer or key');
      assert.equal(windowFor(),win,'Changing assignment reuses the output window');
      await assertPixel(background==='blue'?[255,0,0,255]:[0,0,0,255]);
    }
    assert.deepEqual(await clocks(),before);
    assert.equal(await ctl('S.liveTimerView'), 't2','Routed output does not change legacy or OBS view');
    assert.equal((await send({label:'Unplugged display'})).code,'DISPLAY_NOT_CONNECTED');
    assert.equal(windowFor(),win);

    // Verify the operator-facing table saves a choice without opening output.
    await ctl(`api.closeRoutedOutputs();$('audienceRoutingPanel').open=true`);
    await wait(()=>!windowFor(),'Close routed outputs did not close the window');
    await ctl(`(()=>{
      const row=[...$('audienceRoutingPanel').querySelectorAll('tbody tr')].find(row=>row.cells[0].textContent.startsWith(${JSON.stringify(route.label)}));
      const select=row.querySelector('select');select.value='t1';select.dispatchEvent(new Event('change'));
    })()`);
    assert.equal(await ctl(`JSON.parse(localStorage.getItem('pt_routes')).routes[0].view`),'t1');
    assert.equal(windowFor(),undefined);
    // Toggle from the real Control UI and exercise each mode before routing.
    assert.equal(await ctl("$('timerThreeHost').hidden"),true);
    await ctl(`$('chkThird').click();document.querySelector('[data-mode-tertiary="countup"]').click();
      $('btnTertiaryStart').click()`);
    await wait(()=>ctl("S.tertiary.running&&S.tertiary.mode==='countup'"),'Timer 3 stopwatch did not start');
    await ctl("$('btnTertiaryStart').click();$('btnTertiaryReset').click()");
    assert.equal(await ctl("!S.tertiary.running&&S.tertiary.elapsedMs===0"),true);
    await ctl(`document.querySelector('[data-mode-tertiary="countdown"]').click()`);
    await wait(()=>ctl(`!document.querySelector('[data-adj-tertiary="60"]').disabled`),'Countdown adjustments not enabled');
    await ctl(`$('tertiaryChips').querySelector('button').click();$('btnTertiaryStart').click();
      document.querySelector('[data-adj-tertiary="60"]').click();`);
    assert.equal(await ctl("S.tertiary.running&&S.tertiary.durationMs===120000"),true);
    assert.deepEqual(await clocks(),before,'Timer 3 transport must leave the other deadlines intact');
    await ctl(`document.querySelector('[data-mode-tertiary="clock"]').click();
      document.querySelector('[data-mode-secondary="countup"]').click();$('btnSecondaryStart').click();`);
    await wait(()=>ctl("$('btnTertiaryStart').disabled"),'Wall clock should not have a transport');
    assert.equal(await ctl("JSON.parse(localStorage.getItem('pt_settings')).tertiary.mode"),'clock');
    for(const [view,modes] of [['t3',['clock']],['t13',['countdown','clock']],
      ['t23',['countup','clock']],['all',['countdown','countup','clock']]]){
      assert.equal((await send({view,split:'rows',background:'luma'})).ok,true);
      await wait(()=>out(`S?.audienceProjected&&S.dualSplit==='rows'&&[S.mode,S.secondary?.mode,S.tertiary?.mode]
        .filter(Boolean).join(',')===${JSON.stringify(modes.join(','))}&&
        ['timer','secondaryTimer','tertiaryTimer'].filter(id=>$(id).getBoundingClientRect().width>0).length===${modes.length}`),
        'Wrong panes or modes for '+view);
      assert.equal(await out(`getComputedStyle($('tertiaryPane')).boxShadow==='none'`),true);
    }
    await ctl("$('chkThird').click()");
    await wait(()=>out(`!S.thirdTimer&&S.dualTimer&&getComputedStyle($('tertiaryPane')).display==='none'`),
      'Disabling Timer 3 did not remove it from a live combined output');
    assert.equal((await send({view:'t3'})).code,'TIMER_DISABLED');
    console.log('THREE_TIMER_MODES_AND_OUTPUT_COMBINATIONS_OK=true');
  }finally{
    await ctl(`api.closeRoutedOutputs();localStorage.removeItem('pt_routes');S.blackout=false;if(S.thirdTimer)$('chkThird').click();bothRunning(false,true);`);
  }
  console.log('AUDIENCE_ROUTES_AND_HDMI_KEY_PIXELS_OK=true');
};
