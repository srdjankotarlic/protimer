const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const TimerTools = require('../timer-tools');

test('secondary zero alerts restore independently and do not opt into primary audio', () => {
  const defaults = TimerTools.secondary();
  assert.equal(defaults.flashZero, true);
  assert.equal(defaults.soundZero, false);
  const legacy = { flashZero: false, soundZero: true };
  const migrated = TimerTools.secondary({ durationMs: 30000 }, legacy);
  assert.equal(migrated.flashZero, false);
  assert.equal(migrated.soundZero, false);
  legacy.flashZero = true;
  assert.equal(migrated.flashZero, false, 'Migration must not link future checkbox changes');
  const saved = TimerTools.secondary({ flashZero: true, soundZero: true, running: true }, { flashZero: false });
  assert.equal(saved.flashZero, true);
  assert.equal(saved.soundZero, true);
  assert.equal(saved.running, false);
  assert.equal(TimerTools.secondary({ flashZero: false, soundZero: false }, defaults).flashZero, false);
});

test('separate output projects only its own zero-alert choices without changing clocks', () => {
  const state = { dualTimer: true, separateOutputs: true, flashZero: true, soundZero: false,
    secondary: { ...TimerTools.secondary({ flashZero: false, soundZero: true }), running: true, endAt: 12345 } };
  const before = structuredClone(state);
  const first = TimerTools.outputState(state, 'primary');
  const second = TimerTools.outputState(state, 'secondary');
  assert.equal(first.flashZero, true);
  assert.equal(first.soundZero, false);
  assert.equal(second.flashZero, false);
  assert.equal(second.soundZero, true);
  assert.equal(second.endAt, 12345);
  assert.deepEqual(state, before);
  state.separateOutputs = false;
  assert.equal(TimerTools.outputState(state), state);
  const oldState = { dualTimer: true, separateOutputs: true, flashZero: false, soundZero: true, secondary: {} };
  assert.equal(TimerTools.outputState(oldState, 'secondary').flashZero, false);
  assert.equal(TimerTools.outputState(oldState, 'secondary').soundZero, false);
});

// Execute the actual view scripts with a minimal DOM; the network never resolves
// and timers do not run, so each assertion observes exactly one requested frame.
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
  const context = vm.createContext({ document, TimerTools, innerWidth: 900, innerHeight: 500,
    window: { pt: { onWinFs() {}, onState() {}, onAudienceQr() {} }, addEventListener() {} },
    location: { search: '', protocol: 'https:' }, URLSearchParams, AbortController,
    fetch: () => new Promise(() => {}), setInterval() {}, setTimeout() {}, clearTimeout() {} });
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))
    vm.runInContext(match[1], context, { filename: file });
  return { html, document, node: id => document.getElementById(id),
    render(state) { context.applyState(state); context.render(); } };
}

function state() {
  return { mode: 'countdown', durationMs: 30000, running: false, remMs: -1000,
    overtime: true, useWarnColors: false, fgColor: '#ffffff', warnRed: '#fe4545',
    flashZero: false, soundZero: false, dualTimer: true, separateOutputs: false,
    text: '', message: { text: 'Wrap up', flash: true },
    secondary: { ...TimerTools.secondary({ flashZero: true }), remMs: -1000 } };
}

for (const [file, primary, secondary] of [
  ['output.html', 'timer', 'secondaryTimer'], ['remote.html', 'time', 'secondaryTime']
]) {
  test(`${file}: timer checkboxes independently stop blinking immediately and retain overtime red`, () => {
    const page = view(file), current = state();
    page.render(current);
    assert.equal(page.node(primary).classList.contains('blink'), false);
    assert.equal(page.node(secondary).classList.contains('blink'), true);
    for (const id of [primary, secondary]) {
      assert.equal(page.node(id).style.color, current.warnRed);
      assert.match(page.node(id).textContent, /^−/);
    }
    current.flashZero = true; current.secondary.flashZero = false;
    page.render(current);
    assert.equal(page.node(primary).classList.contains('blink'), true);
    assert.equal(page.node(secondary).classList.contains('blink'), false);
    current.flashZero = false;
    page.render(current);
    assert.equal(page.node(primary).classList.contains('blink'), false);
    assert.equal(page.node(primary).style.color, current.warnRed);
    assert.equal(page.document.body.classList.contains('flash'), false);
    if (file === 'output.html') assert.equal(page.node('msg').className, 'flash');
  });

  test(`${file}: zero stays red with warnings and overtime off; clock/countup never blink`, () => {
    const page = view(file), current = state();
    current.flashZero = current.secondary.flashZero = true;
    current.overtime = current.secondary.overtime = false;
    current.remMs = current.secondary.remMs = 1000;
    page.render(current);
    for (const id of [primary, secondary]) {
      assert.equal(page.node(id).classList.contains('blink'), false);
      assert.notEqual(page.node(id).style.color, current.warnRed);
    }
    for (const remaining of [0, -5000]) {
      current.remMs = current.secondary.remMs = remaining;
      page.render(current);
      for (const id of [primary, secondary]) {
        assert.equal(page.node(id).textContent, '0:00');
        assert.equal(page.node(id).style.color, current.warnRed);
        assert.equal(page.node(id).classList.contains('blink'), true);
        assert.equal(page.node(id).classList.contains('neg'), false);
      }
    }
    for (const mode of ['countup', 'clock']) {
      current.mode = current.secondary.mode = mode;
      current.elapsedMs = current.secondary.elapsedMs = 4000;
      page.render(current);
      for (const id of [primary, secondary]) {
        assert.equal(page.node(id).classList.contains('blink'), false);
        assert.notEqual(page.node(id).style.color, current.warnRed);
      }
    }
  });
}

test('standalone Timer 2 uses its setting; zero flashing is confined to timer digits', () => {
  const page = view('output.html'), current = state();
  current.separateOutputs = true;
  page.render(TimerTools.outputState(current, 'secondary'));
  assert.equal(page.node('timer').classList.contains('blink'), true);
  current.secondary.flashZero = false; current.flashZero = true;
  page.render(TimerTools.outputState(current, 'secondary'));
  assert.equal(page.node('timer').classList.contains('blink'), false);
  assert.equal(page.node('timer').style.color, current.warnRed);
  assert.doesNotMatch(page.html, /body\.flash|zflash|function doFlash/);
  assert.match(page.html, /#timer\.blink\{animation:/);
  assert.match(page.html, /#secondaryTimer\.blink\{animation:/);
  assert.match(page.html, /#msg\.flash\{animation:/);
});
