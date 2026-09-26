const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const TimerTools = require('../timer-tools');

test('secondary overtime migrates once, defaults on, and persists independently', () => {
  assert.equal(TimerTools.secondary().overtime, true);
  for (const overtime of [false, true]) {
    const legacy = { overtime };
    const migrated = TimerTools.secondary({ durationMs: 30000 }, legacy);
    assert.equal(migrated.overtime, overtime);
    legacy.overtime = !overtime;
    assert.equal(migrated.overtime, overtime, 'Primary changes must not change the migrated setting');
    const saved = JSON.parse(JSON.stringify({ ...migrated, running: true, endAt: 12345 }));
    const restored = TimerTools.secondary(saved, legacy);
    assert.equal(restored.overtime, overtime, 'Explicit saved values override the legacy primary setting');
    assert.equal(restored.running, false);
    assert.equal(restored.endAt, 0);
    assert.equal(restored.remMs, 30000);
  }
});

function state(overtime) {
  return { mode: 'countdown', durationMs: 30000, running: true, endAt: 95000, remMs: 30000,
    overtime, useWarnColors: false, fgColor: '#ffffff', warnRed: '#fe4545',
    flashZero: false, dualTimer: true, separateOutputs: false, text: '',
    secondary: { ...TimerTools.secondary({ overtime: !overtime, flashZero: false }),
      running: true, endAt: 95000 } };
}

test('separate Timer 2 projection uses its overtime choice without changing either clock', () => {
  for (const overtime of [false, true]) {
    const current = state(overtime);
    current.separateOutputs = true;
    const before = structuredClone(current);
    const first = TimerTools.outputState(current, 'primary');
    const second = TimerTools.outputState(current, 'secondary');
    assert.equal(first.overtime, overtime);
    assert.equal(second.overtime, !overtime);
    for (const field of ['durationMs', 'remMs', 'endAt', 'running', 'elapsedMs', 'startAt'])
      assert.equal(second[field], current.secondary[field]);
    assert.deepEqual(current, before);
    delete current.secondary.overtime;
    assert.equal(TimerTools.outputState(current, 'secondary').overtime, overtime);
    current.separateOutputs = false;
    assert.equal(TimerTools.outputState(current), current);
  }
});

// Run each actual view at a fixed host time, with no network or scheduled frames.
function view(file) {
  const nodes = new Map();
  function element() {
    const node = { style: {}, className: '', textContent: '', innerHTML: '', value: '',
      clientWidth: 900, clientHeight: 500, children: [],
      addEventListener() {}, appendChild(child) { this.children.push(child); },
      querySelectorAll: () => [], querySelector: () => null };
    const classes = () => new Set(node.className.split(/\s+/).filter(Boolean));
    node.classList = {
      contains(name) { return classes().has(name); },
      add(name) { const values = classes(); values.add(name); node.className = [...values].join(' '); },
      remove(name) { const values = classes(); values.delete(name); node.className = [...values].join(' '); },
      toggle(name, enabled) { enabled ??= !this.contains(name); this[enabled ? 'add' : 'remove'](name); return enabled; }
    };
    return node;
  }
  const document = { body: element(), documentElement: element(), addEventListener() {},
    querySelectorAll: () => [], createElement: element,
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); } };
  class FixedDate extends Date { static now() { return 100000; } }
  const context = vm.createContext({ document, TimerTools, Date: FixedDate, innerWidth: 900, innerHeight: 500,
    window: { pt: { onWinFs() {}, onState() {}, onAudienceQr() {} }, addEventListener() {} },
    location: { search: '', protocol: 'https:' }, URLSearchParams, AbortController,
    fetch: () => new Promise(() => {}), setInterval() {}, setTimeout() {}, clearTimeout() {} });
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))
    vm.runInContext(match[1], context, { filename: file });
  return { node: id => document.getElementById(id),
    render(current) { context.applyState(current); context.render(); } };
}

function assertCountdown(node, overtime, flashZero, color) {
  assert.equal(node.textContent, overtime ? '−0:05' : '0:00');
  assert.equal(node.style.color, color);
  assert.equal(node.classList.contains('neg'), overtime);
  assert.equal(node.classList.contains('blink'), flashZero);
}

for (const [file, primary, secondary] of [
  ['output.html', 'timer', 'secondaryTimer'], ['remote.html', 'time', 'secondaryTime']
]) {
  for (const overtime of [false, true]) {
    test(`${file}: T1 overtime ${overtime}, T2 overtime ${!overtime} remain independent at zero`, () => {
      const page = view(file), current = state(overtime);
      const before = structuredClone(current);
      page.render(current);
      assertCountdown(page.node(primary), overtime, false, current.warnRed);
      assertCountdown(page.node(secondary), !overtime, false, current.warnRed);
      assert.deepEqual(current, before, 'Clamping the display must not alter running clocks');
      current.secondary.flashZero = true;
      page.render(current);
      assertCountdown(page.node(primary), overtime, false, current.warnRed);
      assertCountdown(page.node(secondary), !overtime, true, current.warnRed);
      current.flashZero = true; current.secondary.flashZero = false;
      page.render(current);
      assertCountdown(page.node(primary), overtime, true, current.warnRed);
      assertCountdown(page.node(secondary), !overtime, false, current.warnRed);
    });
  }

  test(`${file}: old live states retain shared overtime until secondary has its own setting`, () => {
    const page = view(file);
    for (const overtime of [false, true]) {
      const current = state(overtime);
      delete current.secondary.overtime;
      page.render(current);
      assertCountdown(page.node(primary), overtime, false, current.warnRed);
      assertCountdown(page.node(secondary), overtime, false, current.warnRed);
    }
  });
}

test('standalone Timer 2 renders its own overtime and zero-alert choices', () => {
  const page = view('output.html');
  for (const overtime of [false, true]) {
    const current = state(overtime);
    current.separateOutputs = true;
    const before = structuredClone(current);
    page.render(TimerTools.outputState(current, 'secondary'));
    assertCountdown(page.node('timer'), !overtime, false, current.warnRed);
    assert.deepEqual(current, before);
  }
});
