'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MAX_CAPTURE_PIXELS } = require('../output-quality');

// Only called by the existing --smoke harness, which supplies disposable
// userData. Use the real output.html windows and their native capture path.
module.exports = async function smokeOutputQuality({ controlWin, getOutput, getSecondary, screen }) {
  const ctl = source => controlWin.webContents.executeJavaScript(source);
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const waitFor = async (predicate, message) => {
    const deadline = Date.now() + 3500;
    while (!await predicate()) {
      assert.ok(Date.now() < deadline, message);
      await delay(30);
    }
  };
  const output = (role, source) => (role === 'secondary' ? getSecondary() : getOutput()).webContents.executeJavaScript(source);
  const windowState = win => win && !win.isDestroyed()
    ? { bounds: win.getBounds(), fullscreen: win.isFullScreen(), displayId: screen.getDisplayMatching(win.getBounds()).id }
    : null;
  const saved = await ctl(`({s:JSON.parse(JSON.stringify(S)),autoNext,zeroFired,lang,
    target:$('outputWindowTarget').value,layoutTarget:$('layoutTarget').value,
    settings:localStorage.getItem('pt_settings')})`);
  const windows = { primary: windowState(getOutput()), secondary: windowState(getSecondary()) };
  const controlBounds = controlWin.getBounds();
  const host = screen.getDisplayMatching(controlBounds);
  const clocks = `JSON.stringify([S,S.secondary].map(s=>({mode:s.mode,durationMs:s.durationMs,
    running:s.running,remMs:s.remMs,endAt:s.endAt,elapsedMs:s.elapsedMs,startAt:s.startAt})))`;
  let checks = 0;
  const check = (name, value) => { assert.ok(value, name); checks++; console.log(name + '=true'); };
  const ready = role => waitFor(() => {
    const win = role === 'secondary' ? getSecondary() : getOutput();
    return win && !win.webContents.isLoading() && output(role, '!!S');
  }, `The ${role} output did not load`);
  const resize = async (role, width, height) => {
    const wasClosed = !(role === 'secondary' ? getSecondary() : getOutput());
    const displaySelector = role === 'secondary' ? 'secondaryDisplaySel' : 'displaySel';
    await waitFor(() => ctl(`!!document.querySelector('#${displaySelector} option[value="${host.id}"]')`),
      `The ${role} display selector did not contain the test display`);
    const displayId = await ctl(`(async()=>{selectPlacement(${JSON.stringify(role)});$('${displaySelector}').value=${JSON.stringify(String(host.id))};$('outputWidth').value=${width};
      $('outputHeight').value=${height};const displayId=Number($('${displaySelector}').value);await applyOutputSize();return displayId;})()`);
    await ready(role);
    await waitFor(() => output(role, `innerWidth===${width}&&innerHeight===${height}&&!isFS`),
      `The ${role} renderer did not reach ${width} × ${height}`);
    const win = role === 'secondary' ? getSecondary() : getOutput();
    await waitFor(() => win.isVisible(), `Apply size left the ${role} output hidden`);
    if (wasClosed) {
      await waitFor(() => screen.getDisplayMatching(win.getBounds()).id === displayId,
        `Apply size opened the ${role} output on the wrong display`);
      const geometry = await ctl(role === 'secondary' ? 'api.getSecondaryOutputGeometry()' : 'api.getOutputGeometry()');
      check('OUTPUT_QUALITY_APPLY_OPENS_' + role.toUpperCase(), geometry.displayId === displayId && win.isVisible());
    }
  };
  const dom = async role => {
    // An occluded native window may postpone its periodic paint on macOS.
    // Paint the actual received state; never replace its renderer or font.
    return output(role, `(()=>{render();const timer=$('timer'),a=$('primaryPane').getBoundingClientRect(),
      b=$('secondaryPane').getBoundingClientRect();return {protocol:location.protocol,
      width:innerWidth,height:innerHeight,dpr:devicePixelRatio,text:timer.textContent,
      tag:timer.tagName,fontSize:parseFloat(getComputedStyle(timer).fontSize),
      transform:$('primaryContent').style.transform,secondaryText:$('secondaryTimer').textContent,
      dual:S.dualTimer,split:S.dualSplit,panes:[{x:a.x,y:a.y,width:a.width,height:a.height},
      {x:b.x,y:b.y,width:b.width,height:b.height}]};})()`);
  };
  const quality = async (role, label) => {
    const win = role === 'secondary' ? getSecondary() : getOutput();
    const bounds = win.getBounds();
    const live = await dom(role);
    const result = await ctl(`(async()=>{const before=${clocks};const quality=await api.getOutputQuality(${JSON.stringify(role)});
      return {quality,clocksUnchanged:before===${clocks}};})()`);
    const q = result.quality;
    assert.equal(q.ok, true, `${label}: ${JSON.stringify(q)}`);
    assert.equal(q.role, role);
    assert.equal(q.renderer.width, live.width);
    assert.equal(q.renderer.height, live.height);
    assert.equal(q.renderer.devicePixelRatio, live.dpr);
    assert.ok(Number.isFinite(q.renderer.devicePixelRatio) && q.renderer.devicePixelRatio > 0);
    assert.equal(q.renderer.zoomFactor, 1);
    assert.equal(q.geometry.width, live.width);
    assert.equal(q.geometry.height, live.height);
    const display = screen.getDisplayMatching(win.getBounds());
    assert.equal(q.geometry.scaleFactor, display.scaleFactor);
    assert.equal(q.geometry.displayWidth, display.bounds.width);
    assert.equal(q.geometry.displayHeight, display.bounds.height);
    assert.equal(q.geometry.pixelWidth, Math.round(live.width * display.scaleFactor));
    assert.equal(q.geometry.pixelHeight, Math.round(live.height * display.scaleFactor));
    const pixelCount = Math.max(q.geometry.pixelWidth * q.geometry.pixelHeight,
      Math.ceil(live.width * live.dpr) * Math.ceil(live.height * live.dpr));
    if (pixelCount > MAX_CAPTURE_PIXELS) {
      assert.equal(q.captureStatus, 'too-large', `${label}: large captures must remain bounded`);
      assert.equal(q.capture, null);
    } else {
      assert.equal(q.captureStatus, 'verified', `${label}: native capture was not verified`);
      assert.ok(q.capture && Math.abs(q.capture.width - Math.round(live.width * live.dpr)) <= 1 &&
        Math.abs(q.capture.height - Math.round(live.height * live.dpr)) <= 1,
      `${label}: capture ${JSON.stringify(q.capture)} disagrees with viewport × DPR`);
    }
    assert.deepEqual(win.getBounds(), bounds, `${label}: quality read moved or resized the output`);
    check(label, live.protocol === 'file:' && live.tag === 'DIV' && live.fontSize > 0 && result.clocksUnchanged);
    console.log(label + '_MEASUREMENTS=' + JSON.stringify(q));
    return { quality: q, dom: live };
  };
  try {
    await ctl(`autoNext=false;cancelAutoAdvance();S.dualTimer=false;S.separateOutputs=false;
      S.transparent=false;S.gridOn=false;S.secondary.gridOn=false;S.fitWindow=false;S.blackout=false;
      S.text='';S.textOnly=false;S.message={text:'',flash:false};S.showNowNext=false;S.showProgress=false;
      S.soundZero=false;S.secondary.soundZero=false;S.outputLayout=TimerTools.layout();
      S.secondary.layout=TimerTools.layout();setDuration(600000);secondaryDuration(330000);syncDualUI();send();`);
    await waitFor(() => !getSecondary(), 'Single output mode retained Timer 2 output');
    await ctl('api.closeOutput();');
    await waitFor(() => !getOutput(), 'Primary output did not close before Apply size');
    await resize('primary', 1280, 720);
    await waitFor(() => output('primary', `!!S&&!S.dualTimer&&S.durationMs===600000`), 'Primary test state did not arrive');
    const forbidden = await output('primary', `api.getOutputQuality('primary')`);
    const invalid = await ctl(`api.getOutputQuality('other')`);
    check('OUTPUT_QUALITY_CONTROL_ONLY', !forbidden.ok && forbidden.code === 'FORBIDDEN' && !invalid.ok && invalid.code === 'INVALID_ROLE');
    const hd = await quality('primary', 'OUTPUT_QUALITY_HD_NATIVE');
    assert.equal(hd.quality.clipped, false);
    await resize('primary', 1920, 1080);
    const fullHD = await quality('primary', 'OUTPUT_QUALITY_FULL_HD_NATIVE');
    check('OUTPUT_QUALITY_TEXT_RESIZES', Math.abs(fullHD.dom.fontSize / hd.dom.fontSize - 1.5) < .01 && !fullHD.quality.clipped);

    await ctl(`S.dualTimer=true;S.separateOutputs=true;S.secondary.outputSize={width:1280,height:720};
      S.secondary.layout=TimerTools.layout({scale:75,x:0,y:0});syncDualUI();send();`);
    assert.equal(getSecondary(), null, 'Selecting separate outputs must leave Timer 2 closed until Apply size');
    await resize('secondary', 1280, 720);
    await waitFor(() => output('secondary', `!!S&&S.durationMs===330000&&!S.dualTimer`), 'Secondary test state did not arrive');
    const secondary = await quality('secondary', 'OUTPUT_QUALITY_SECONDARY_NATIVE');
    check('OUTPUT_QUALITY_INDEPENDENT_LAYOUT', secondary.dom.text === '5:30' &&
      secondary.dom.transform === 'translate(0%, 0%) scale(0.75)' && !secondary.quality.clipped &&
      await output('primary', `$('primaryContent').style.transform==='translate(0%, 0%) scale(1)'`));

    // Begin the asynchronous primary measurement, then synchronously change the
    // editing role before IPC can return. The old result must not fill Timer 2.
    const stale = await ctl(`(async()=>{selectPlacement('primary');const pending=checkOutputQuality();
      selectPlacement('secondary');await pending;return {role:selectedWindow(),
      status:$('outputQualityStatus').textContent,readout:$('outputQualityReadout').textContent,
      measured:$('outputQualityReadout').textContent.includes(t('outputCapture'))||
        $('outputQualityReadout').textContent.includes(t('outputRenderer')),
      checked:$('outputQualityStatus').textContent.includes(t('outputChecked')),
      disabled:$('btnCheckOutput').disabled};})()`);
    check('OUTPUT_QUALITY_SELECTED_ROLE_GUARD', stale.role === 'secondary' && !stale.disabled && !stale.measured && !stale.checked);
    await ctl(`checkOutputQuality()`);
    check('OUTPUT_QUALITY_SELECTED_ROLE_UI', await ctl(`$('outputQualityStatus').textContent.includes(t('timerTwo'))&&
      $('outputQualityStatus').textContent.includes(t('outputChecked'))&&
      $('outputQualityReadout').textContent.includes(t('outputRenderer'))&&
      $('outputQualityReadout').textContent.includes('1280')`));
    for (const language of ['sr', 'en']) {
      for (const width of [820, 1120]) {
        controlWin.setContentSize(width, 740);
        await ctl(`lang=${JSON.stringify(language)};applyLang();renderOutputQuality();`);
        check(`OUTPUT_QUALITY_REFLOW_${language}_${width}`, await ctl(`(()=>{const p=$('outputQualityReadout').parentElement,r=p.getBoundingClientRect();
          return p.scrollWidth<=p.clientWidth+2&&r.left>=0&&r.right<=innerWidth+1;})()`));
      }
    }
    // The native output windows can cover Control. Its DOM scroll position can
    // update before the compositor paints it, leaving a correctly sized crop of
    // the previous screen. Raise the harness window and wait for the new frame.
    controlWin.moveTop();
    controlWin.focus();
    await ctl(`lang='en';applyLang();$('outputQualityPanel').scrollIntoView({behavior:'instant',block:'center'});`);
    await ctl(`new Promise(resolve=>{const timeout=setTimeout(resolve,500);
      requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timeout);resolve();}));})`);
    await delay(100);
    const crop = await ctl(`(()=>{const panel=$('outputQualityPanel'),r=panel.getBoundingClientRect(),
      main=document.querySelector('.main').getBoundingClientRect();
      if(r.top<main.top||r.bottom>main.bottom||r.left<0||r.right>innerWidth||
        !panel.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))) return null;
      const x=Math.floor(r.x),y=Math.floor(r.y);
      return {x,y,width:Math.ceil(r.right)-x,height:Math.ceil(r.bottom)-y};})()`);
    assert.ok(crop, 'The output quality panel must be fully visible before its screenshot');
    const screenshot = path.join(os.tmpdir(), 'protimer-output-quality.png');
    fs.writeFileSync(screenshot, (await controlWin.webContents.capturePage(crop)).toPNG());
    console.log('OUTPUT_QUALITY_SCREENSHOT=' + screenshot);

    // Closing, querying and publishing fresh timer state must leave both native
    // outputs closed. The timers themselves continue with unchanged deadlines.
    await ctl(`bothRunning(true);api.closeSecondaryOutput();api.closeOutput();`);
    await waitFor(() => !getOutput() && !getSecondary(), 'Outputs did not close for read-only quality check');
    const closed = await ctl(`(async()=>{const before=${clocks};const results=await Promise.all([
      api.getOutputQuality('primary'),api.getOutputQuality('secondary')]);send();
      return {results,clocksUnchanged:before===${clocks}};})()`);
    await delay(60);
    check('OUTPUT_QUALITY_CLOSED_READ_ONLY', closed.clocksUnchanged && closed.results.every(q => !q.ok && q.code === 'OUTPUT_CLOSED') &&
      !getOutput() && !getSecondary() && await ctl('S.running&&S.secondary.running'));

    await ctl(`bothRunning(false);S.separateOutputs=false;S.secondary.layout=TimerTools.layout();
      S.dualSplit='columns';S.outputSize={width:1280,height:720};syncDualUI();send();api.sendToDisplay(${host.id});`);
    await ready('primary');
    await resize('primary', 1280, 720);
    await ctl('bothRunning(true);');
    for (const split of ['columns', 'rows']) {
      await ctl(`S.dualSplit=${JSON.stringify(split)};send();`);
      await waitFor(() => output('primary', `!!S&&S.dualTimer&&S.running&&S.secondary.running&&S.dualSplit===${JSON.stringify(split)}`), 'Combined layout state did not arrive');
      const combined = await quality('primary', 'OUTPUT_QUALITY_COMBINED_' + split.toUpperCase());
      const [a, b] = combined.dom.panes;
      check('OUTPUT_QUALITY_PANES_' + split.toUpperCase(), !combined.quality.clipped &&
        a.width === b.width && a.height === b.height && (split === 'columns' ? b.x > a.x : b.y > a.y));
    }
    await ctl(`S.outputLayout=TimerTools.layout({scale:200,x:45,y:0});send();`);
    await waitFor(() => output('primary', 'S.outputLayout.scale===200&&S.outputLayout.x===45'), 'Clipping test state did not arrive');
    const clipped = await quality('primary', 'OUTPUT_QUALITY_CLIPPING_PROBE');
    check('OUTPUT_QUALITY_CLIPPING_WARNING', clipped.quality.clipped);
    console.log('OUTPUT_QUALITY_SMOKE_CHECKS=' + checks);
    console.log('OUTPUT_QUALITY_SMOKE_OK=true');
  } finally {
    await ctl(`api.closeSecondaryOutput();api.closeOutput();`);
    await waitFor(() => !getOutput() && !getSecondary(), 'Quality smoke cleanup did not close test outputs');
    await ctl(`S=${JSON.stringify(saved.s)};autoNext=${JSON.stringify(saved.autoNext)};
      zeroFired=${JSON.stringify(saved.zeroFired)};lang=${JSON.stringify(saved.lang)};
      syncDualUI();applyLang();selectPlacement(${JSON.stringify(saved.target)});
      $('layoutTarget').value=${JSON.stringify(saved.layoutTarget)};syncLayoutUI();send();
      ${saved.settings === null ? "localStorage.removeItem('pt_settings');" : `localStorage.setItem('pt_settings',${JSON.stringify(saved.settings)});`}`);
    controlWin.setBounds(controlBounds);
    for (const role of ['primary', 'secondary']) {
      if (!windows[role]) continue;
      await ctl(role === 'primary' ? `api.sendToDisplay(${windows[role].displayId});` : `api.openSecondaryOutput(${windows[role].displayId});`);
      await ready(role);
      const win = role === 'secondary' ? getSecondary() : getOutput();
      win.setBounds(windows[role].bounds);
      if (windows[role].fullscreen) win.setFullScreen(true);
    }
  }
};
