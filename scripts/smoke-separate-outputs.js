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
  await ctl(`$('chkDual').checked=true; $('chkDual').dispatchEvent(new Event('change')); S.transparent=false; S.gridOn=false; S.secondary.gridOn=false; S.fitWindow=false; S.blackout=false; S.text=''; S.textOnly=false; S.message={text:'',flash:false}; S.outputLayout=TimerTools.layout(); S.secondary.layout=TimerTools.layout(); setDuration(600000); secondaryDuration(330000); $('outputRouting').value='separate'; $('outputRouting').dispatchEvent(new Event('change'));`);
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
  const unchangedPrimary = step => assert.deepEqual(getOutput().getBounds(), primaryBounds, step);
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
    'Native fullscreen did not restore the first output');
  unchangedPrimary('After second fullscreen');
  const secondaryBounds = getSecondary().getBounds();
  await ctl(`$('btnFs').click();`);
  await waitFor(() => first('isFS'), 'First output did not enter fullscreen');
  await ctl(`$('btnFs').click();`);
  await waitFor(() => first('!isFS'), 'Control failed to exit first output fullscreen');
  await waitFor(() => JSON.stringify(getSecondary().getBounds())===JSON.stringify(secondaryBounds),
    'Native fullscreen did not restore the second output');
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
  // Every placement edit is scoped to the selected timer. The two selectors
  // are the same editing context, not independent, potentially conflicting roles.
  const boundsEqual = (win, expected) => Object.entries(expected).every(([key,value])=>win.getBounds()[key]===value);
  const gridBounds = (display, n, cell) => {
    const {x,y,width,height}=display.bounds, w=Math.floor(width/n), h=Math.floor(height/n);
    return {x:x+(cell%n)*w,y:y+Math.floor(cell/n)*h,width:w,height:h};
  };
  const secondDisplay=screen.getDisplayMatching(getSecondary().getBounds());
  const choose = role => ctl(`$('gridTarget').value='${role}'; $('gridTarget').dispatchEvent(new Event('change'));`);
  const setGrid = (n,cell) => ctl(`document.querySelector('#gridSizes [data-gs="${n}"]').click(); $('gridSel').children[${cell}].click();`);
  const savedClockState=await ctl(`({a:S.remMs,b:S.secondary.remMs,aRun:S.running,bRun:S.secondary.running})`);
  const secondBeforeGrid=getSecondary().getBounds();
  await choose('primary'); await setGrid(3,0);
  await waitFor(()=>boundsEqual(getOutput(),gridBounds(host,3,0)), 'Timer 1 grid did not use its selected display');
  assert.deepEqual(getSecondary().getBounds(),secondBeforeGrid,'Primary grid edit changed Timer 2');
  await choose('secondary');
  assert.equal(await ctl(`$('outputWindowTarget').value==='secondary'&&$('layoutTarget').value==='secondary'&&Number($('timerScaleValue').value)===65`),true);
  await setGrid(5,24);
  await waitFor(()=>boundsEqual(getSecondary(),gridBounds(secondDisplay,5,24)), 'Timer 2 grid did not use its own display/cell');
  assert.ok(boundsEqual(getOutput(),gridBounds(host,3,0)), 'Timer 2 grid changed Timer 1');
  await ctl(`$('timerYValue').value=-12; $('timerYValue').dispatchEvent(new Event('input'));`);
  await waitFor(()=>second(`$('primaryContent').style.transform==='translate(9%, -12%) scale(0.65)'`),'Selected timer digit position was not applied');
  assert.equal(await first(`$('primaryContent').style.transform`),'translate(0%, 0%) scale(1)');
  // Sizing Timer 2 must not disable/reposition Timer 1's grid.
  await ctl(`(async()=>{ $('outputWidth').value=800; $('outputHeight').value=450; await applyOutputSize(); })()`);
  assert.deepEqual(getSecondary().getContentSize(),[800,450]);
  assert.equal(await ctl('S.gridOn&&!S.secondary.gridOn'),true);
  assert.ok(boundsEqual(getOutput(),gridBounds(host,3,0)));
  await setGrid(5,24);
  await waitFor(()=>boundsEqual(getSecondary(),gridBounds(secondDisplay,5,24)),'Secondary grid did not restore');
  await choose('primary');
  assert.equal(await ctl(`$('chkGrid').checked&&$('gridSel').children.length===9&&Number($('timerScaleValue').value)===100`),true);
  await ctl(`(async()=>{ $('outputWidth').value=640; $('outputHeight').value=360; await applyOutputSize(); })()`);
  assert.deepEqual(getOutput().getContentSize(),[640,360]);
  assert.equal(await ctl('!S.gridOn&&S.secondary.gridOn'),true);
  assert.ok(boundsEqual(getSecondary(),gridBounds(secondDisplay,5,24)), 'Sizing Timer 1 moved Timer 2');
  await setGrid(3,0);
  await waitFor(()=>boundsEqual(getOutput(),gridBounds(host,3,0)),'Primary grid did not restore');
  assert.deepEqual(await ctl(`({a:S.remMs,b:S.secondary.remMs,aRun:S.running,bRun:S.secondary.running})`),savedClockState);
  await choose('secondary');
  const keyboard=await ctl(`(()=>{const before=S.secondary.gridCell,clock=S.secondary.remMs,cell=$('gridSel').children[24];cell.focus();cell.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));return {focused:document.activeElement===$('gridSel').children[23],unchanged:S.secondary.gridCell===before&&S.secondary.remMs===clock,tabStops:$('gridSel').querySelectorAll('[tabindex="0"]').length,label:document.activeElement.getAttribute('aria-label')};})()`);
  assert.deepEqual(keyboard,{focused:true,unchanged:true,tabStops:1,label:'Red 5, kolona 4'});
  await ctl(`$('gridPanel').scrollIntoView({block:'center'});`); await delay(100);
  fs.writeFileSync(path.join(os.tmpdir(),'protimer-independent-grid.png'),(await controlWin.webContents.capturePage()).toPNG());
  await ctl(`$('outputLayoutPanel').scrollIntoView({block:'start'});`); await delay(100);
  fs.writeFileSync(path.join(os.tmpdir(),'protimer-independent-placement.png'),(await controlWin.webContents.capturePage()).toPNG());
  console.log('INDEPENDENT_GRID_PLACEMENT_OK');
  await ctl(`$('dualPanel').scrollIntoView({block:'start'});`); await delay(100);
  fs.writeFileSync(path.join(os.tmpdir(), 'protimer-separate-outputs.png'), (await controlWin.webContents.capturePage()).toPNG());
  for (const width of [820, 1120]) {
    controlWin.setContentSize(width, 740);
    for (const language of ['sr', 'en']) {
      await ctl(`lang='${language}'; S.lang=lang; applyLang(); $('dualPanel').scrollIntoView({block:'start'});`);
      const layout = await ctl(`(()=>{const ids=['outputRouting','secondaryDisplaySel','btnOpenSecondaryOut','btnSecondaryFs','btnCloseSecondaryOut','outputWindowTarget','gridTarget','outputWidth','outputHeight','timerScaleValue'];return {clipped:ids.some(id=>{const r=$(id).getBoundingClientRect();return r.left<0||r.right>innerWidth;}),label:$('outputTargetLabel').textContent,secondary:$('secondaryOutputStatus').textContent};})()`);
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
  assert.deepEqual(await ctl(`({first:TimerTools.grid(S),second:TimerTools.grid(S.secondary)})`),{
    first:{gridOn:true,gridSize:3,gridCell:0}, second:{gridOn:true,gridSize:5,gridCell:24}
  });
  await ctl(`$('outputRouting').value='together'; $('outputRouting').dispatchEvent(new Event('change'));`);
  await waitFor(() => !getSecondary(), 'Combined mode left the second output open');
  await waitFor(() => first(`!!S&&S.dualTimer&&$('stage').classList.contains('rows')`), 'Combined layout was not restored');
  const disabled = await ctl(`api.openSecondaryOutput(${hostDisplay})`);
  assert.equal(disabled.ok, false);
  assert.equal(await ctl(`$('outputWindowTargetLabel').hidden&&$('gridTargetRow').hidden&&!$('layoutTargetLabel').hidden&&!$('dualSplitLabel').hidden`),true,'Combined mode must hide per-screen options but keep per-timer digits');
  await ctl(`$('chkDual').checked=false; $('chkDual').dispatchEvent(new Event('change'));`);
  assert.equal(await ctl(`$('dualOptions').hidden&&$('outputWindowTargetLabel').hidden&&$('gridTargetRow').hidden&&$('layoutTargetLabel').hidden&&selectedLayout()===S.outputLayout&&selectedGrid()===S`),true,'Single timer must hide all secondary editing controls');
  assert.deepEqual(await ctl(`TimerTools.grid(S.secondary)`),{gridOn:true,gridSize:5,gridCell:24},'Hiding a second timer must preserve its grid');
  await ctl(`$('chkDual').checked=true; $('chkDual').dispatchEvent(new Event('change')); $('outputRouting').value='separate'; $('outputRouting').dispatchEvent(new Event('change'));`);
  assert.equal(getSecondary(),null,'Re-enabling separate mode must not reopen a closed TV');
  await ctl(`$('outputRouting').value='together'; $('outputRouting').dispatchEvent(new Event('change'));`);
  console.log('SEPARATE_OUTPUTS_OK');
};
