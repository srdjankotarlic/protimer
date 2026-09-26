const { test } = require('node:test');
const assert = require('node:assert/strict');
const tools = require('../timer-tools');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('all inline scripts parse, shared browser module is packaged', () => {
  for (const file of ['controller.html', 'output.html', 'remote.html', 'backstage.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1], { filename: file });
  }
  for (const file of ['timer-tools.js', 'window-tools.js', 'secondary-output.js', 'tunnel-tools.js', 'scripts/smoke-layout.js', 'scripts/smoke-separate-outputs.js', 'scripts/smoke-startup.js', 'scripts/smoke-rundown.js', 'scripts/smoke-network-ui.js'])
    assert.ok(require('../package.json').build.files.includes(file));
  assert.ok(require('../package.json').build.mac.extendInfo.NSLocalNetworkUsageDescription.includes('local network'));
});
test('exact output sizes reject invalid dimensions without truncation', () => {
  assert.deepEqual(tools.size({ width: 1920, height: 1080 }), { width: 1920, height: 1080 });
  for (const width of [0, 79, 7681, 1920.5, '1920', NaN, Infinity]) assert.equal(tools.size({ width, height: 1080 }), null);
  for (const height of [0, 59, 4321, NaN]) assert.equal(tools.size({ width: 1920, height }), null);
});
test('layout defaults and bounds are predictable', () => {
  assert.deepEqual(tools.layout(), { scale: 100, x: 0, y: 0 });
  assert.deepEqual(tools.layout({ scale: 50, x: -12.5, y: 25 }), { scale: 50, x: -12.5, y: 25 });
  assert.deepEqual(tools.layout({ scale: 999, x: -200, y: NaN }), { scale: 200, x: -100, y: 0 });
});
test('grid normalization and migration preserve old placement without linking timers', () => {
  assert.deepEqual(tools.grid(), { gridOn: false, gridSize: 3, gridCell: 4 });
  assert.deepEqual(tools.grid({ gridOn: true, gridSize: 5, gridCell: 999 }), { gridOn: true, gridSize: 5, gridCell: 24 });
  assert.deepEqual(tools.grid({ gridSize: -1, gridCell: NaN }), tools.grid());
  const legacy = { gridOn: true, gridSize: 7, gridCell: 42 };
  const restored = tools.secondary({ durationMs: 90000 }, legacy);
  assert.deepEqual(tools.grid(restored), legacy);
  restored.gridCell = 8;
  assert.equal(legacy.gridCell, 42);
  const independent = tools.secondary({ ...restored, gridOn: false }, legacy);
  assert.deepEqual(tools.grid(independent), { gridOn: false, gridSize: 7, gridCell: 8 });
  assert.equal(independent.running, false);
});
test('two timers run independently, pause precisely and resume idempotently', () => {
  const a = tools.secondary({ durationMs: 60000 });
  const b = tools.secondary({ durationMs: 90000 });
  tools.setRunning(a, true, 1000); tools.setRunning(b, true, 1000);
  tools.setRunning(a, true, 2000); // retries cannot restart or pause a timer
  assert.equal(tools.remaining(a, 6000), 55000);
  assert.equal(tools.remaining(b, 6000), 85000);
  tools.setRunning(b, false, 6000);
  assert.equal(tools.remaining(b, 20000), 85000);
  assert.equal(tools.remaining(a, 20000), 41000);
  tools.reset(a); assert.equal(a.remMs, 60000); assert.equal(b.remMs, 85000);
  tools.setRunning(b, true, 20000); assert.equal(tools.remaining(b, 21000), 84000);
});
test('relaunch restores durations and layout but never stale running state', () => {
  const restored = tools.secondary({ durationMs: 90000, running: true, endAt: 10, remMs: -500, layout: { scale: 65, x: 3, y: -2 } });
  assert.equal(restored.running, false); assert.equal(restored.remMs, 90000);
  assert.deepEqual(restored.layout, { scale: 65, x: 3, y: -2 });
});

test('secondary countup uses the existing host timestamps and pauses independently', () => {
  const timer = tools.secondary({ mode: 'countup', durationMs: 0 });
  assert.equal(timer.mode, 'countup'); assert.equal(timer.durationMs, 0);
  tools.setRunning(timer, true, 1000); tools.setRunning(timer, true, 5000);
  assert.equal(timer.startAt, 1000); assert.equal(tools.elapsed(timer, 7000), 6000);
  tools.setRunning(timer, false, 7000); assert.equal(tools.elapsed(timer, 15000), 6000);
  tools.setRunning(timer, true, 15000); assert.equal(tools.elapsed(timer, 17000), 8000);
  tools.reset(timer); assert.equal(timer.running, false); assert.equal(tools.elapsed(timer, 50000), 0);
});

test('secondary clock cannot accidentally start a countdown; output projects its real mode', () => {
  const timer = tools.secondary({ mode: 'clock', running: true, startAt: 10, elapsedMs: 9000 });
  assert.equal(timer.running, false); assert.equal(timer.elapsedMs, 0);
  tools.setRunning(timer, true, 1000); assert.equal(timer.running, false); assert.equal(timer.endAt, 0);
  const state = { mode: 'countdown', dualTimer: true, separateOutputs: true, secondary: timer, elapsedMs: 123, startAt: 45 };
  assert.equal(tools.outputState(state, 'secondary').mode, 'clock');
  timer.mode = 'countup'; timer.elapsedMs = 6000; timer.startAt = 1000; timer.running = true;
  const projected = tools.outputState(state, 'secondary');
  assert.equal(projected.mode, 'countup'); assert.equal(projected.elapsedMs, 6000); assert.equal(projected.startAt, 1000);
  assert.equal(tools.outputState(state, 'primary').mode, 'countdown');
});

test('secondary mode migration defaults old settings to countdown and never auto-resumes', () => {
  assert.equal(tools.secondary({ durationMs: 300000 }).mode, 'countdown');
  assert.equal(tools.secondary({ mode: 'invalid' }).mode, 'countdown');
  for (const mode of ['countdown', 'countup', 'clock']) {
    const timer = tools.secondary({ mode, running: true, remMs: -2000, elapsedMs: 30000, endAt: 500, startAt: 200 });
    assert.equal(timer.mode, mode); assert.equal(timer.running, false); assert.equal(timer.endAt, 0);
    assert.equal(timer.startAt, 0); assert.equal(timer.elapsedMs, 0); assert.equal(timer.remMs, timer.durationMs);
  }
});
