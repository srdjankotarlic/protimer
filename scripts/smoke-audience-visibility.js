'use strict';
const assert = require('node:assert/strict');
const { BrowserWindow } = require('electron');

module.exports = async function ({ controlWin, getOutput, getSecondary, screen, serverPort }) {
  const ctl = code => controlWin.webContents.executeJavaScript(code);
  const run = (win, code) => win.webContents.executeJavaScript(code);
  const wait = async (probe, message) => {
    const deadline = Date.now() + 6500;
    while (!await probe()) {
      assert.ok(Date.now() < deadline, message);
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  };
  const reload = () => new Promise(resolve => {
    controlWin.webContents.once('did-finish-load', resolve);
    controlWin.webContents.reload();
  });
  const host = screen.getDisplayMatching(controlWin.getBounds());
  await ctl(`api.closeSecondaryOutput();api.closeOutput();bothRunning(false);
    S.dualTimer=false;S.separateOutputs=false;S.liveTimerView='both';S.freeAudience=false;
    S.outputLayer='normal';S.gridOn=false;S.fitWindow=false;S.outputSize={width:800,height:500};
    S.outputLayout=TimerTools.layout();S.secondary.layout=TimerTools.layout();
    S.blackout=false;S.textOnly=false;S.transparent=false;S.soundZero=false;S.secondary.soundZero=false;
    setDuration(600000);secondaryDuration(420000);syncDualUI();send();
    $('chkDual').checked=false;$('chkDual').dispatchEvent(new Event('change'));
    $('chkDual').checked=true;$('chkDual').dispatchEvent(new Event('change'));`);
  assert.equal(await ctl('S.liveTimerView'), 'both', 'Re-enabling Timer 2 must reveal both timers, including after a saved T1-only selection');
  await ctl(`$('displaySel').value='${host.id}';$('btnOpenOut').click();`);
  await wait(() => getOutput()?.isVisible(), 'Output did not open');
  const viewer = new BrowserWindow({width:800,height:500,useContentSize:true,show:false,
    transparent:true,backgroundColor:'#00000000',webPreferences:{backgroundThrottling:false}});
  try {
    await viewer.loadURL(`http://127.0.0.1:${serverPort}/`);
    const visible = `S?.dualTimer&&getComputedStyle($('secondaryPane')).display!=='none'&&getComputedStyle($('secondaryTimer')).visibility==='visible'&&$('secondaryTimer').getBoundingClientRect().height>10`;
    for (const split of ['columns', 'rows']) {
      for (const free of [false, true]) {
        for (const mode of ['countdown', 'countup', 'clock']) {
          await ctl(`$('dualSplit').value='${split}';$('dualSplit').dispatchEvent(new Event('change'));
            $('chkFreeAudience').checked=${free};$('chkFreeAudience').dispatchEvent(new Event('change'));
            document.querySelector('[data-mode-secondary="${mode}"]').click();`);
          for (const win of [getOutput(), viewer]) await wait(() => run(win, visible), `T2 invisible in ${split}/${free}/${mode}`);
        }
      }
    }
    await ctl(`$('btnStart').click();`);
    const deadline = await ctl('S.endAt');
    // A live selection remains explicit for the current session.
    for (const [type, expected] of [['liveT1','t1'],['liveT2','t2'],['liveBoth','both']]) {
      assert.equal((await ctl(`applyDeckOperation({type:'${type}',timerId:'t1'})`)).ok, true);
      assert.equal(await ctl('S.liveTimerView'), expected);
      assert.equal(await ctl('S.endAt'), deadline);
    }
    await ctl(`$('outputRouting').value='separate';$('outputRouting').dispatchEvent(new Event('change'));
      $('secondaryDisplaySel').value='${host.id}';$('btnOpenSecondaryOut').click();`);
    await wait(() => getSecondary()?.isVisible(), 'Separate T2 output did not open');
    await wait(() => run(getSecondary(), `S?.outputTimerId==='t2'&&!S.liveHidden&&getComputedStyle($('stage')).visibility==='visible'&&$('timer').getBoundingClientRect().height>10`), 'Separate T2 output is hidden');
    assert.equal(await ctl('S.endAt'), deadline);

    // Keep a colored background or alpha while all foreground layers disappear.
    await ctl(`$('outputRouting').value='together';$('outputRouting').dispatchEvent(new Event('change'));
      api.closeSecondaryOutput();S.bgColor='#234567';S.text='TITLE';S.message={text:'MESSAGE',flash:false};
      S.showProgress=true;S.showNowNext=true;cues=[{name:'Cue',durationMs:600000}];currentCue=0;
      $('blackoutMode').value='foreground';$('blackoutMode').dispatchEvent(new Event('change'));
      $('btnBlackout').click();`);
    const hidden = `document.body.classList.contains('foreground-hidden')&&getComputedStyle($('blackout')).display==='none'&&['timer','secondaryTimer','text','msg','nownext','prog','audienceQr'].every(id=>getComputedStyle($(id)).visibility==='hidden')`;
    for (const win of [getOutput(), viewer]) await wait(() => run(win, hidden), 'Foreground blackout left content visible');
    await wait(() => run(viewer, `getComputedStyle(document.body).backgroundColor==='rgb(35, 69, 103)'`), 'Blackout changed the configured background');
    await ctl(`$('chkTransparent').checked=true;$('chkTransparent').dispatchEvent(new Event('change'));`);
    await wait(() => run(viewer, `getComputedStyle(document.body).backgroundColor==='rgba(0, 0, 0, 0)'`), 'Transparency did not reach viewer');
    await wait(() => getOutput()?.isVisible(), 'Transparent native output did not reopen');
    for (const win of [getOutput(), viewer]) {
      await wait(() => run(win, hidden), 'Transparent blackout exposed foreground');
      await wait(async () => {
        const pixels = (await win.webContents.capturePage()).toBitmap();
        for (let i=3;i<pixels.length;i+=4) if (pixels[i]!==0) return false;
        return true;
      }, 'Hidden transparent output contains opaque pixels');
    }
    await ctl(`$('outputRouting').value='separate';$('outputRouting').dispatchEvent(new Event('change'));$('btnOpenSecondaryOut').click();`);
    await wait(() => getSecondary()?.isVisible(), 'Transparent second output did not open');
    for (const win of [getOutput(), getSecondary(), viewer]) await wait(() => run(win, hidden), 'Separate output ignored foreground blackout');
    assert.equal(await ctl('S.endAt'), deadline);
    await ctl(`$('btnSecondaryBlackout').click();`);
    for (const win of [getOutput(), getSecondary(), viewer]) await wait(() => run(win, `!document.body.classList.contains('foreground-hidden')&&getComputedStyle($('timer')).visibility==='visible'`), 'Restoring foreground failed');
    await ctl(`$('blackoutMode').value='black';$('blackoutMode').dispatchEvent(new Event('change'));$('btnBlackout').click();`);
    await wait(() => run(viewer, `getComputedStyle($('blackout')).display==='block'&&!document.body.classList.contains('foreground-hidden')`), 'Traditional black screen failed');
    await ctl(`$('btnBlackout').click();$('blackoutMode').value='foreground';$('blackoutMode').dispatchEvent(new Event('change'));saveSettings();
      $('outputRouting').value='together';$('outputRouting').dispatchEvent(new Event('change'));
      const legacy=JSON.parse(localStorage.getItem('pt_settings'));legacy.liveTimerView='t1';localStorage.setItem('pt_settings',JSON.stringify(legacy));
      api.closeOutput();api.closeSecondaryOutput();`);
    await wait(() => !getOutput()&&!getSecondary(), 'Outputs did not close');
    await reload();
    assert.equal(await ctl(`S.dualTimer&&S.liveTimerView==='both'&&S.blackoutMode==='foreground'&&$('blackoutMode').value==='foreground'&&!S.running&&!S.secondary.running`), true);
    assert.equal(getOutput(), null);
    assert.equal(getSecondary(), null);
    await ctl(`$('btnOpenOut').click();`);
    await wait(() => getOutput()?.isVisible(), 'Restored output did not open');
    await wait(() => run(getOutput(), visible), 'Restored settings hid Timer 2');
    console.log('TIMER2_TOGGLE_ALL_LAYOUTS_BROWSER_SEPARATE_RESTORE_OK=true');
    console.log('BLACKOUT_BACKGROUND_ALPHA_RESTORE_AND_CLOCK_ISOLATION_OK=true');
  } finally { viewer.destroy(); }
};
