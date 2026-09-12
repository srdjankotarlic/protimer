'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Called only by --smoke, which uses a disposable userData profile.
module.exports = async function smokeStartup({ app, BrowserWindow, screen, controlWin, getOutput, waitLoad }) {
  const js = source => controlWin.webContents.executeJavaScript(source);
  const waitFor = async predicate => {
    const deadline = Date.now() + 6000;
    while (!await predicate()) {
      assert.ok(Date.now() < deadline, 'Timed out waiting for an explicit output action');
      await delay(50);
    }
  };
  const assertClosed = async () => {
    await delay(500);
    assert.equal(getOutput(), null, 'Output must not be created, even as a hidden window');
    assert.deepEqual(BrowserWindow.getAllWindows(), [controlWin]);
    assert.equal(await js('api.isOutputOpen()'), false);
    assert.equal(await js('outputOpen'), false);
  };

  await assertClosed();
  await waitFor(() => js("!$('bdgOut').classList.contains('on')"));
  fs.writeFileSync(path.join(os.tmpdir(), 'protimer-control-only-startup.png'), (await controlWin.webContents.capturePage()).toPNG());
  console.log('CONTROL_ONLY_STARTUP_OK=true');

  // Exercise the real persisted-settings load path, not just a fresh profile.
  const original = await js("localStorage.getItem('pt_settings')");
  await js(`localStorage.setItem('pt_settings', JSON.stringify({
    gridOn:true, gridSize:5, gridCell:24, transparent:true, fitWindow:true,
    outputSize:{width:1920,height:1080}, dualTimer:true, dualSplit:'rows',
    outputLayout:{scale:80,x:10,y:-10}, secondary:{durationMs:900000}, durationMs:600000
  }))`);
  controlWin.reload();
  await waitLoad(controlWin);
  await assertClosed();
  const restored=await js('({grid:S.gridOn,transparent:S.transparent,fit:S.fitWindow,dual:S.dualTimer,width:S.outputSize?.width,running:S.running,secondaryRunning:S.secondary.running})');
  assert.deepEqual(restored,{grid:true,transparent:true,fit:true,dual:true,width:1920,running:false,secondaryRunning:false});
  // Re-activation and monitor changes also leave a closed output closed.
  app.emit('activate');
  screen.emit('display-added', {}, screen.getPrimaryDisplay());
  await assertClosed();
  console.log('RESTORED_SETTINGS_NO_OUTPUT_OK=true');

  await js(original === null
    ? "localStorage.removeItem('pt_settings')"
    : `localStorage.setItem('pt_settings', ${JSON.stringify(original)})`);
  controlWin.reload();
  await waitLoad(controlWin);
  await assertClosed();

  const displayId = screen.getPrimaryDisplay().id;
  const send = async () => {
    await waitFor(() => js(`!!document.querySelector('#displaySel option[value="${displayId}"]')`));
    await js(`$('displaySel').value='${displayId}'; $('btnOpenOut').click()`);
    await waitFor(() => !!getOutput());
    const output = getOutput();
    await waitLoad(output);
    await waitFor(() => output.isVisible());
    assert.equal(screen.getDisplayMatching(output.getBounds()).id, displayId);
    await waitFor(() => js('outputOpen'));
    assert.equal(BrowserWindow.getAllWindows().length, 2);
  };
  await send();
  await js("$('btnCloseOut').click()");
  await waitFor(() => getOutput() === null);
  await js("$('btnStart').click(); $('btnStart').click(); $('btnReset').click(); $('btnFs').click()");
  await assertClosed();
  await send();
  console.log('EXPLICIT_OUTPUT_OPEN_CLOSE_REOPEN_OK=true');
};
