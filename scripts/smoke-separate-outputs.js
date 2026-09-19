const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

module.exports = async function ({ controlWin, getOutput, getSecondary, screen }) {
  const ctl = async code => {
    try { return await controlWin.webContents.executeJavaScript(code); }
    catch (error) { throw new Error(`Separate-output control step failed: ${code}`, { cause: error }); }
  };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const waitFor = async (probe, message) => {
    for (let i = 0; i < 60; i++) { if (await probe()) return; await delay(50); }
    throw new Error(message);
  };
  const first = code => getOutput().webContents.executeJavaScript(code);
  const second = code => getSecondary().webContents.executeJavaScript(code);
  const host = screen.getDisplayMatching(controlWin.getBounds());
  const hostDisplay = host.id;
  await ctl(`$('chkDual').checked=true; $('chkDual').dispatchEvent(new Event('change')); S.transparent=false; S.gridOn=false; S.fitWindow=false; S.blackout=false; S.text=''; S.textOnly=false; S.message={text:'',flash:false}; S.outputLayout=TimerTools.layout(); S.secondary.layout=TimerTools.layout(); setDuration(600000); secondaryDuration(330000); $('outputRouting').value='separate'; $('outputRouting').dispatchEvent(new Event('change'));`);
  assert.equal(getSecondary(), null, 'Changing mode must not open a second screen');
  await waitFor(() => first(`!!S&&!S.dualTimer&&S.durationMs===600000`), 'Timer 1 did not become standalone');
  // The previous exact-resolution test deliberately exceeds small CI screens.
  // Establish an on-screen window before checking independent native fullscreen;
  // macOS may otherwise restore an older frame when changing Spaces.
  await ctl(`(async()=>{ $('outputWindowTarget').value='primary'; $('outputWidth').value=640; $('outputHeight').value=360; await applyOutputSize(); })()`);
  getOutput().setBounds({x:host.workArea.x+20,y:host.workArea.y+40,width:640,height:360});
  await waitFor(() => first('innerWidth===640&&innerHeight===360&&!isFS'), 'Primary test window was not ready');
  const rejected = await ctl(`api.openSecondaryOutput(999999999)`);
  assert.equal(rejected.ok, false); assert.equal(getSecondary(), null);
  await ctl(`$('secondaryDisplaySel').value=${JSON.stringify(String(hostDisplay))}; $('btnOpenSecondaryOut').click();`);
  await waitFor(() => !!getSecondary(), 'Second output did not open');
  await waitFor(() => second(`!!S&&S.durationMs===330000&&$('timer').textContent==='5:30'&&!S.dualTimer`), 'Timer 2 was not standalone');
  const targetInfo = await ctl(`api.getSecondaryOutputGeometry()`);
  assert.equal(targetInfo.displayId, hostDisplay);
  const primaryBounds = getOutput().getBounds();
  const primaryWindow = getOutput(), geometryCalls = [];
  for (const method of ['setBounds', 'setContentSize']) {
    const original = primaryWindow[method].bind(primaryWindow);
    primaryWindow[method] = (...args) => { geometryCalls.push({method,args,stack:new Error().stack}); return original(...args); };
  }
  const unchangedPrimary = step => assert.deepEqual(getOutput().getBounds(), primaryBounds,
    `${step}: ${JSON.stringify(geometryCalls)}`);
  await ctl(`(async()=>{ $('outputWindowTarget').value='secondary'; $('outputWindowTarget').dispatchEvent(new Event('change')); $('outputWidth').value=800; $('outputHeight').value=450; await applyOutputSize(); })()`);
  assert.deepEqual(getSecondary().getContentSize(), [800, 450]);
  assert.deepEqual(getOutput().getBounds(), primaryBounds, 'Sizing Timer 2 moved Timer 1');
  await ctl(`$('layoutTarget').value='secondary'; syncLayoutUI(); $('timerScaleValue').value=65; $('timerScaleValue').dispatchEvent(new Event('input')); $('timerXValue').value=9; $('timerXValue').dispatchEvent(new Event('input'));`);
  await waitFor(() => second(`$('primaryContent').style.transform==='translate(9%, 0%) scale(0.65)'`), 'Timer 2 digit layout not applied');
  assert.equal(await first(`$('primaryContent').style.transform`), 'translate(0%, 0%) scale(1)');
  await ctl(`$('btnBothStart').click();`);
  await waitFor(() => second('S.running'), 'Second timer did not start');
  const deadlines = await ctl(`({first:S.endAt,second:S.secondary.endAt})`);
  await ctl(`$('btnCloseSecondaryOut').click();`);
  await waitFor(() => !getSecondary(), 'Second output did not close');
  unchangedPrimary('Closing second output');
  assert.equal(getOutput().isDestroyed(), false);
  assert.deepEqual(await ctl(`({first:S.endAt,second:S.secondary.endAt})`), deadlines);
  assert.equal(await ctl('S.running&&S.secondary.running'), true);
  await ctl(`$('btnOpenSecondaryOut').click();`);
  await waitFor(() => !!getSecondary(), 'Second output did not reopen');
  await waitFor(() => second(`!!S&&S.endAt===${deadlines.second}&&S.running`), 'Reopening reset the second timer');
  unchangedPrimary('Reopening second output');
  await ctl(`$('btnSecondaryStart').click();`);
  await waitFor(() => second('!S.running'), 'Second timer did not pause');
  assert.equal(await ctl('S.running'), true);
  await ctl(`$('btnBlackout').click();`);
  await waitFor(() => second(`$('blackout').style.display==='block'`), 'Second output blackout failed');
  await waitFor(() => first(`$('blackout').style.display==='block'`), 'First output blackout failed');
  await ctl(`$('btnBlackout').click(); $('btnBothPause').click();`);
  unchangedPrimary('Before second fullscreen');
  await ctl(`$('btnSecondaryFs').click();`);
  await waitFor(() => second('isFS'), 'Second output did not enter fullscreen');
  await ctl(`$('btnSecondaryFs').click();`);
  await waitFor(() => second('!isFS'), 'Control failed to exit second output fullscreen');
  await waitFor(() => JSON.stringify(getOutput().getBounds())===JSON.stringify(primaryBounds),
    `Native fullscreen did not restore the other output: ${JSON.stringify(geometryCalls)}`);
  unchangedPrimary('After second fullscreen');
  const otherDisplay = screen.getAllDisplays().find(d => d.id !== hostDisplay);
  if (otherDisplay) {
    const clocks = await ctl(`({first:S.remMs,second:S.secondary.remMs})`);
    await ctl(`$('secondaryDisplaySel').value=${JSON.stringify(String(otherDisplay.id))}; $('btnOpenSecondaryOut').click();`);
    await waitFor(() => screen.getDisplayMatching(getSecondary().getBounds()).id === otherDisplay.id,
      'Timer 2 did not reach the other connected display');
    assert.equal(screen.getDisplayMatching(getOutput().getBounds()).id, hostDisplay);
    assert.deepEqual(getOutput().getBounds(), primaryBounds, 'Sending Timer 2 to another display moved Timer 1');
    assert.deepEqual(await ctl(`({first:S.remMs,second:S.secondary.remMs})`), clocks);
    assert.equal(await second('S.durationMs'), 330000);
    assert.equal(await first('S.durationMs'), 600000);
    console.log('CONNECTED_DISPLAYS_ROUTING_OK=' + JSON.stringify({first:host.label||hostDisplay,second:otherDisplay.label||otherDisplay.id}));
  }
  // Explicit output closing must not close the other window, reset either clock
  // or silently recreate the closed output on the next state update.
  await ctl(`$('btnCloseOut').click();`);
  await waitFor(() => !getOutput(), 'First output did not close');
  assert.ok(getSecondary());
  await ctl(`send();`); await delay(75); assert.equal(getOutput(), null);
  await ctl(`$('displaySel').value=${JSON.stringify(String(hostDisplay))}; $('btnOpenOut').click();`);
  await waitFor(() => !!getOutput(), 'First output did not reopen');
  await waitFor(() => first(`!!S&&!S.dualTimer`), 'First output reopened in the wrong mode');
  await ctl(`$('dualPanel').scrollIntoView({block:'start'});`); await delay(100);
  fs.writeFileSync(path.join(os.tmpdir(), 'protimer-separate-outputs.png'), (await controlWin.webContents.capturePage()).toPNG());
  for (const width of [820, 1120]) {
    controlWin.setContentSize(width, 740);
    for (const language of ['sr', 'en']) {
      await ctl(`lang='${language}'; S.lang=lang; applyLang(); $('dualPanel').scrollIntoView({block:'start'});`);
      const layout = await ctl(`(()=>{const ids=['outputRouting','secondaryDisplaySel','btnOpenSecondaryOut','btnSecondaryFs','btnCloseSecondaryOut'];return {clipped:ids.some(id=>{const r=$(id).getBoundingClientRect();return r.left<0||r.right>innerWidth;}),label:$('outputTargetLabel').textContent,secondary:$('secondaryOutputStatus').textContent};})()`);
      assert.equal(layout.clipped, false, `Separate output controls clipped at ${width} ${language}`);
      assert.match(layout.label, language === 'sr' ? /Tajmer 1/ : /Timer 1/);
      assert.match(layout.secondary, language === 'sr' ? /Tajmer 2/ : /Timer 2/);
    }
  }
  await ctl(`lang='sr'; S.lang=lang; applyLang();`);
  await ctl(`saveSettings(); location.reload();`); await delay(350);
  const restored = await ctl(`({separate:S.separateOutputs,size:S.secondary.outputSize,running:S.running||S.secondary.running})`);
  assert.equal(restored.separate, true); assert.equal(restored.running, false);
  assert.deepEqual(restored.size, { width: 800, height: 450 });
  await ctl(`$('outputRouting').value='together'; $('outputRouting').dispatchEvent(new Event('change'));`);
  await waitFor(() => !getSecondary(), 'Combined mode left the second output open');
  await waitFor(() => first(`!!S&&S.dualTimer&&$('stage').classList.contains('rows')`), 'Combined layout was not restored');
  const disabled = await ctl(`api.openSecondaryOutput(${hostDisplay})`);
  assert.equal(disabled.ok, false);
  console.log('SEPARATE_OUTPUTS_OK');
};
