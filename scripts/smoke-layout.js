const { BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports = async function smokeLayout({ controlWin, getOutput, serverPort, token, check }) {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const ctl = code => controlWin.webContents.executeJavaScript(code);
  const out = code => getOutput().webContents.executeJavaScript(code);
  const report = (name, ok, detail) => { console.log(name + '=' + !!ok + ' ' + JSON.stringify(detail)); check(name, ok); };
  const image = async (win, name) => fs.writeFileSync(path.join(os.tmpdir(), name), (await win.webContents.capturePage()).toPNG());
  const waitFor = async (win, condition) => {
    for (let i = 0; i < 60; i++) {
      if (await win.webContents.executeJavaScript(condition)) return true;
      await delay(100);
    }
    return false;
  };
  await ctl(`autoNext=false; cancelAutoAdvance(); reset(); S.text=''; S.textOnly=false; S.message={text:'',flash:false}; S.blackout=false; S.showNowNext=false; S.showProgress=false; S.transparent=false; S.gridOn=false; S.fitWindow=false; S.dualTimer=false; S.outputLayout=TimerTools.layout(); setDuration(600000); send();`);
  await delay(200);
  const sized = await ctl(`(async()=>{ $('outputWidth').value=1920; $('outputHeight').value=1080; await applyOutputSize(); return await api.getOutputGeometry(); })()`);
  await delay(200);
  const viewport = await out(`({width:innerWidth,height:innerHeight})`);
  report('EXACT_OUTPUT_SIZE_OK', sized.width === 1920 && sized.height === 1080 && !sized.fullscreen && viewport.width === 1920 && viewport.height === 1080, { sized, viewport });
  const rejected = await ctl(`api.resizeOutput({width:NaN,height:0})`);
  report('INVALID_OUTPUT_SIZE_OK', rejected.ok === false, rejected);
  // Native fullscreen may be asynchronous (especially on macOS).
  getOutput().setFullScreen(true);
  const fullscreenEntered = await waitFor(getOutput(), 'isFS');
  const resizedFromFS = await ctl(`(async()=>{ $('outputWidth').value=1280; $('outputHeight').value=720; await applyOutputSize(); return await api.getOutputGeometry(); })()`);
  report('RESIZE_FROM_FULLSCREEN_OK', fullscreenEntered && resizedFromFS.width === 1280 && resizedFromFS.height === 720 && !resizedFromFS.fullscreen, {fullscreenEntered,...resizedFromFS});
  await waitFor(getOutput(), 'innerWidth===1280&&innerHeight===720&&!isFS');
  await out('render()');

  const rect = `(()=>{const r=$('timer').getBoundingClientRect(),p=$('primaryPane').getBoundingClientRect();return {width:r.width,height:r.height,x:r.x+r.width/2,y:r.y+r.height/2,pw:p.width,ph:p.height};})()`;
  const before = await out(rect);
  const previewBefore = await ctl(`$('pvTime').getBoundingClientRect().width`);
  await ctl(`$('timerScaleValue').value=50; $('timerScaleValue').dispatchEvent(new Event('input')); $('timerXValue').value=12.5; $('timerXValue').dispatchEvent(new Event('input')); $('timerYValue').value=-10; $('timerYValue').dispatchEvent(new Event('input'));`);
  await delay(150);
  const after = await out(rect);
  const previewAfter = await ctl(`$('pvTime').getBoundingClientRect().width`);
  report('DIGIT_SCALE_POSITION_OK', Math.abs(after.width / before.width - .5) < .01 && Math.abs(after.x - before.x - before.pw * .125) < 2 && Math.abs(after.y - before.y + before.ph * .1) < 2 && Math.abs(previewBefore - previewAfter) < 1, { before, after, previewBefore, previewAfter });
  await image(getOutput(), 'protimer-layout-position.png');
  await ctl(`$('btnLayoutReset').click(); $('chkDual').checked=true; $('chkDual').dispatchEvent(new Event('change')); $('secondaryDurationTrigger').click(); $('durationHours').value=0; $('durationMinutes').value=5; $('durationSeconds').value=30; $('durationPickerConfirm').click();`);
  await delay(150);
  const columns = await out(`(()=>{let a=$('primaryPane').getBoundingClientRect(),b=$('secondaryPane').getBoundingClientRect();return {aw:a.width,bw:b.width,ah:a.height,bh:b.height,ax:a.x,bx:b.x,time:$('secondaryTimer').textContent};})()`);
  report('DUAL_COLUMNS_OK', columns.aw === columns.bw && columns.ah === columns.bh && columns.bx > columns.ax && columns.time === '5:30', columns);
  await image(getOutput(), 'protimer-dual-columns.png');
  await ctl(`$('dualSplit').value='rows'; $('dualSplit').dispatchEvent(new Event('change'));`);
  await delay(150);
  const rows = await out(`(()=>{let a=$('primaryPane').getBoundingClientRect(),b=$('secondaryPane').getBoundingClientRect();return {aw:a.width,bw:b.width,ah:a.height,bh:b.height,ay:a.y,by:b.y};})()`);
  report('DUAL_ROWS_OK', rows.aw === rows.bw && rows.ah === rows.bh && rows.by > rows.ay, rows);
  await image(getOutput(), 'protimer-dual-rows.png');
  await ctl(`$('layoutTarget').value='secondary'; syncLayoutUI(); $('timerScaleValue').value=70; $('timerScaleValue').dispatchEvent(new Event('input')); $('timerXValue').value=-5; $('timerXValue').dispatchEvent(new Event('input'));`);
  await delay(100);
  const separateLayout = await out(`({primary:$('primaryContent').style.transform,secondary:$('secondaryContent').style.transform})`);
  report('INDEPENDENT_DIGIT_LAYOUT_OK', separateLayout.primary === 'translate(0%, 0%) scale(1)' && separateLayout.secondary === 'translate(-5%, 0%) scale(0.7)', separateLayout);
  await ctl(`$('btnBothStart').click();`);
  await delay(250);
  const running = await ctl(`({a:S.running,b:S.secondary.running,remaining:TimerTools.remaining(S.secondary,Date.now())})`);
  await ctl(`$('btnSecondaryStart').click();`);
  const paused = await ctl(`({a:S.running,b:S.secondary.running,remaining:S.secondary.remMs})`);
  report('DUAL_INDEPENDENT_CONTROLS_OK', running.a && running.b && running.remaining < 330000 && paused.a && !paused.b && paused.remaining <= running.remaining, { running, paused });
  await ctl(`$('btnBothReset').click();`);
  const reset = await ctl(`({a:S.running,b:S.secondary.running,am:S.remMs,bm:S.secondary.remMs})`);
  report('DUAL_RESET_OK', !reset.a && !reset.b && reset.am === 600000 && reset.bm === 330000, reset);
  await ctl(`$('dualPanel').scrollIntoView({block:'start'});`);
  await delay(150);
  await image(controlWin, 'protimer-layout-controller.png');
  await ctl(`$('outputLayoutPanel').scrollIntoView({block:'start'});`);
  await delay(150);
  await image(controlWin, 'protimer-layout-controls.png');

  const mobile = new BrowserWindow({ width:390, height:844, useContentSize:true, show:false, webPreferences:{contextIsolation:true} });
  const base = `http://127.0.0.1:${serverPort}`;
  try {
    await mobile.loadURL(base + '/remote?t=invalid');
    const unauthorized = await waitFor(mobile, `authError && $('btnStart').disabled && !$('connectionHelp').hidden`);
    report('PHONE_AUTH_FEEDBACK_OK', unauthorized, await mobile.webContents.executeJavaScript(`$('connectionHelpText').textContent`));
    await mobile.loadURL(base + '/remote?t=' + token);
    const connected = await waitFor(mobile, `authorized && connectionHealthy && !!S && !$('btnStart').disabled && !$('secondaryRemote').hidden`);
    report('PHONE_AUTH_CONNECT_OK', connected, await mobile.webContents.executeJavaScript(`({overflow:document.documentElement.scrollWidth>innerWidth,dual:!$('secondaryRemote').hidden})`));
    await mobile.webContents.executeJavaScript(`$('btnBothStart').click()`);
    const remoteStarted = await waitFor(controlWin, `S.running&&S.secondary.running`);
    await waitFor(mobile, `!commandPending && S.running && S.secondary.running`);
    await mobile.webContents.executeJavaScript(`$('btnSecondaryStart').click()`);
    const remotePaused = await waitFor(controlWin, `S.running&&!S.secondary.running`);
    report('PHONE_DUAL_COMMANDS_OK', remoteStarted && remotePaused, { remoteStarted, remotePaused });
    await waitFor(mobile, '!commandPending');
    // Simulate a real transport failure; do not touch host networking or user settings.
    await mobile.webContents.executeJavaScript(`window.realFetch=window.fetch; window.fetch=()=>Promise.reject(new Error('test offline')); pollController?.abort();`);
    const offline = await waitFor(mobile, `!connectionHealthy && $('btnStart').disabled && !$('connectionHelp').hidden`);
    await mobile.webContents.executeJavaScript(`window.fetch=window.realFetch; $('btnReconnect').click();`);
    const recovered = await waitFor(mobile, `connectionHealthy && !$('btnStart').disabled`);
    report('PHONE_RECONNECT_OK', offline && recovered, { offline, recovered });
    await mobile.webContents.executeJavaScript(`window.fetch=(url,options)=>String(url)==='/cmd'?Promise.reject(new Error('test failed command')):window.realFetch(url,options); $('btnReset').click();`);
    const commandFailure = await waitFor(mobile, `!commandPending && $('commandStatus').textContent===tr('commandFailed')`);
    report('PHONE_COMMAND_FAILURE_OK', commandFailure, commandFailure);
    await mobile.webContents.executeJavaScript(`window.fetch=window.realFetch; $('btnBothPause').click();`);
    await waitFor(controlWin, `!S.running&&!S.secondary.running`);
    await image(mobile, 'protimer-phone-dual.png');
  } finally { mobile.destroy(); }
  if (process.env.PROTIMER_TEST_ONLINE === '1') {
    const online = new BrowserWindow({width:390,height:844,useContentSize:true,show:false,webPreferences:{contextIsolation:true}});
    try {
      const share = await ctl('api.shareStart()');
      if (!share.url) throw new Error('Online transport unavailable: ' + (share.error || 'no URL'));
      await online.loadURL(share.url + '/remote?t=' + token);
      const connected = await waitFor(online, `authorized&&connectionHealthy&&!!S`);
      const latencies = [];
      for (const running of [true, false, true, false]) {
        const started = Date.now();
        await online.webContents.executeJavaScript(`cmd('bothRunning',${running})`);
        const applied = await waitFor(controlWin, `S.running===${running}&&S.secondary.running===${running}`);
        if (!applied) throw new Error('Online command was not applied');
        latencies.push(Date.now() - started);
      }
      report('PHONE_REAL_HTTPS_OK', connected, {connected,provider:share.provider,commandRoundTripMs:latencies});
    } finally { online.destroy(); await ctl('api.shareStop()'); }
  }
  // Preference round-trip: shape/size/duration survive, running state does not.
  await ctl(`saveSettings(); location.reload();`);
  await delay(350);
  const restored = await ctl(`({dual:S.dualTimer,split:S.dualSplit,size:S.outputSize,layout:S.secondary.layout,duration:S.secondary.durationMs,running:S.running||S.secondary.running})`);
  report('LAYOUT_SETTINGS_RESTORE_OK', restored.dual && restored.split === 'rows' && restored.size.width === 1280 && restored.layout.scale === 70 && restored.duration === 330000 && !restored.running, restored);
};
