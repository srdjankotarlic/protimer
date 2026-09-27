'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const TimerTools = require('../timer-tools');

const html = fs.readFileSync(path.join(__dirname, '..', 'controller.html'), 'utf8');
function section(start, end) {
  const first = html.indexOf(start), last = html.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Controller section exists: ${start}`);
  return html.slice(first, last);
}
function geometry(width = 1920, scaleFactor = 1) {
  return { width, height: 1080, fullscreen: false, displayId: 7, displayLabel: 'Stage TV',
    displayWidth: 1920, displayHeight: 1080, refreshRate: 59.94, scaleFactor,
    pixelWidth: width * scaleFactor, pixelHeight: 1080 * scaleFactor, zoomFactor: 1 };
}
function result(role = 'primary', info = geometry()) {
  return { ok: true, role, geometry: info,
    renderer: { width: info.width, height: info.height, devicePixelRatio: info.scaleFactor, zoomFactor: 1 },
    capture: { width: info.pixelWidth, height: info.pixelHeight }, captureStatus: 'verified', clipped: false };
}
function host(check = async role => result(role)) {
  const nodes = new Map(), requests = [], state = { dualTimer: true, separateOutputs: true,
    mode: 'countdown', running: true, endAt: 123456, remMs: 1000, outputLayout: TimerTools.layout(),
    secondary: TimerTools.secondary({ running: true, endAt: 765432 }), message: { text: '' } };
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', hidden: false, disabled: false,
      addEventListener(event, handler) { this[event] = handler; } });
    return nodes.get(id);
  };
  node('outputWindowTarget').value = node('layoutTarget').value = 'primary';
  const context = vm.createContext({ TimerTools, S: state, $: node, lastDisplays: [],
    localStorage: { getItem: () => 'en' }, syncLayoutUI() {}, buildGrid() {},
    syncOutputSizeFields() { vm.runInContext('renderOutputSizeStatus()', context); },
    api: { async getOutputQuality(role) { requests.push(role); return check(role); } }
  });
  vm.runInContext(section('const I18N = {', 'function applyLang(){'), context);
  vm.runInContext(section('let lastOutputGeometry=null', 'function syncOutputSizeFields(){'), context);
  const run = code => vm.runInContext(code, context);
  const show = (info, role = 'primary') => {
    context.nextGeometry = info;
    run(`${role === 'primary' ? 'showOutputGeometry' : 'showSecondaryOutputGeometry'}(nextGeometry)`);
  };
  show(geometry()); show(geometry(1280, 2), 'secondary');
  return { node, run, show, requests, state, check: () => node('btnCheckOutput').click() };
}

test('a check reads only the chosen output and distinguishes logical, captured and renderer pixels', async () => {
  const h = host(async role => result(role, geometry(1280, 2)));
  h.run("selectPlacement('secondary')");
  const before = structuredClone(h.state);
  await h.check();
  assert.deepEqual(h.requests, ['secondary']);
  assert.deepEqual(h.state, before, 'Checking must not change either timer or placement settings');
  assert.match(h.node('outputQualityStatus').textContent, /Timer 2 · Last check/);
  assert.match(h.node('outputSizeStatus').textContent, /1280 × 1080 logical units/);
  assert.match(h.node('outputQualityReadout').textContent, /Measured app capture: 2560 × 2160 px/);
  assert.match(h.node('outputQualityReadout').textContent, /App renderer: 1280 × 1080 CSS px · DPR 2/);
  assert.match(h.node('outputQualityReadout').textContent, /59.94 Hz/);
  assert.equal(h.node('outputQualityClipping').hidden, true);
});

test('capture fallback keeps renderer measurements and labels the raster only as an estimate', async () => {
  for (const captureStatus of ['unavailable', 'too-large']) {
    const h = host(async role => ({ ...result(role), capture: null, captureStatus, clipped: true }));
    await h.check();
    const readout = h.node('outputQualityReadout').textContent;
    assert.match(readout, /Estimated window raster: 1920 × 1080 px/);
    assert.match(readout, /App renderer: 1920 × 1080 CSS px/);
    assert.doesNotMatch(readout, /Measured app capture|HDMI.*verified|Full HD/);
    assert.match(readout, captureStatus === 'too-large' ? /Capture skipped because of its size/ : /Capture unavailable/);
    assert.equal(h.node('outputQualityClipping').hidden, false);
  }
});

test('switching away and back discards an in-flight result without retaining a checked status', async () => {
  let resolve;
  const h = host(() => new Promise(done => { resolve = done; }));
  const pending = h.check();
  assert.equal(h.node('btnCheckOutput').disabled, true);
  h.run("selectPlacement('secondary'); selectPlacement('primary')");
  resolve(result());
  await pending;
  assert.match(h.node('outputQualityStatus').textContent, /Timer 1 · Output has not been checked/);
  assert.doesNotMatch(h.node('outputQualityReadout').textContent, /Measured app capture|App renderer/);
  assert.equal(h.node('btnCheckOutput').disabled, false);
});

test('geometry changes discard in-flight measurements and failures do not overwrite a newer request', async () => {
  const completions = [];
  const h = host(() => new Promise((resolve, reject) => completions.push({ resolve, reject })));
  const first = h.check();
  h.show(geometry(1200));
  const second = h.check();
  completions[1].resolve(result('primary', geometry(1200)));
  await second;
  completions[0].reject(new Error('old request failed'));
  await first;
  assert.match(h.node('outputQualityStatus').textContent, /Last check/);
  assert.match(h.node('outputQualityReadout').textContent, /Measured app capture: 1200 × 1080 px/);
  assert.doesNotMatch(h.node('outputQualityReadout').textContent, /1920 × 1080 px/);
});

test('presentation edits clear clipping and capture snapshots while clock ticks retain them', async () => {
  const h = host(async role => ({ ...result(role), clipped: true }));
  await h.check();
  h.state.remMs = 500; h.state.endAt += 1000;
  h.run('refreshOutputQualityContext()');
  assert.match(h.node('outputQualityStatus').textContent, /Last check/);
  for (const edit of [
    () => { h.state.outputLayout.scale = 120; },
    () => { h.state.outputLayout.x = 12; },
    () => { h.state.textOnly = true; },
    () => { h.state.gridOn = true; },
    () => { h.state.dualSplit = 'rows'; }
  ]) {
    await h.check(); edit(); h.run('refreshOutputQualityContext()');
    assert.doesNotMatch(h.node('outputQualityStatus').textContent, /Last check/);
    assert.doesNotMatch(h.node('outputQualityReadout').textContent, /Measured app capture|App renderer/);
    assert.equal(h.node('outputQualityClipping').hidden, true);
  }
});

test('closed output is distinct from failure and bilingual status survives language changes', async () => {
  for (const [code, expected] of [
    ['OUTPUT_CLOSED', /Output window is closed/],
    ['OUTPUT_CHANGED', /Output changed. Check again/],
    ['OUTPUT_UNAVAILABLE', /Check is currently unavailable/]
  ]) {
    const h = host(async () => ({ ok: false, code }));
    await h.check();
    assert.match(h.node('outputQualityStatus').textContent, expected);
    assert.equal(h.node('btnCheckOutput').disabled, false);
    assert.equal(h.node('outputQualityClipping').hidden, true);
    if (code === 'OUTPUT_CLOSED') {
      assert.equal(h.node('outputQualityReadout').hidden, true);
      h.run("lang='sr';renderOutputQuality()");
      assert.match(h.node('outputQualityStatus').textContent, /Tajmer 1 · Izlazni prozor je zatvoren/);
    }
  }
  const h = host(); await h.check();
  h.run("lang='sr';renderOutputQuality()");
  assert.match(h.node('outputQualityStatus').textContent, /Tajmer 1 · Poslednja provera/);
  assert.match(h.node('outputQualityReadout').textContent, /Izmeren snimak aplikacije/);
});
