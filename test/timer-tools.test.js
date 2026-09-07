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
  assert.ok(require('../package.json').build.files.includes('timer-tools.js'));
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
