const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const TimerTools = require('../timer-tools');

const controller = fs.readFileSync(path.join(__dirname, '..', 'controller.html'), 'utf8');
function section(start, end) {
  const first = controller.indexOf(start), last = controller.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Controller section exists: ${start}`);
  return controller.slice(first, last);
}

// Execute the controller's actual state, persistence, handlers, and Deck host
// adapter, replacing surrounding UI/IPC dependencies without starting timers.
function host(settings) {
  const storage = new Map(), nodes = new Map();
  let sent = 0, deck;
  if (settings) storage.set('pt_settings', JSON.stringify(settings));
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', checked: false,
      addEventListener(event, handler) { this[event] = handler; }
    });
    return nodes.get(id);
  }
  const context = vm.createContext({ TimerTools, lang: 'en', cues: [], currentCue: -1,
    autoNext: false, cueDraftMs: 0, selectedCue: null, zeroFired: false, deckControl: null,
    bellAudio: {}, window: { ProTimerDeckController: true },
    ProTimerDeckController(value) { deck = value; return Promise.resolve(null); },
    localStorage: { getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value) },
    engineClock: { sample: () => 100000 }, processZeroAlerts() {},
    api: { sendState() { sent++; }, deckInvoke() {} },
    syncDualUI() {}, syncDurationDisplays() {}, buildGrid() {}, renderCues() {},
    cancelAutoAdvance() {}, clearTargetArm() {}, updateButtons() {}, setModeTabs() {},
    $: node
  });
  for (const [start, end] of [
    ['let S = {', 'let lastNetInfo ='],
    ['function pad(n)', 'function parseTime(str)'],
    ['function send(){', '// ---------- RASPORED'],
    ['function saveCues(){', '// ---------- MONITORI'],
    ['async function applyDeckOperation(op){', '</script>']
  ]) vm.runInContext(section(start, end), context, { filename: 'controller.html' });
  for (const id of ['chkOver', 'chkOver2']) {
    const handler = controller.split('\n').find(line => line.startsWith(`$('${id}').addEventListener`));
    assert.ok(handler, `Real ${id} handler exists`);
    vm.runInContext(handler, context, { filename: 'controller.html' });
  }
  const run = code => vm.runInContext(code, context);
  run('load()');
  return { state: run('S'), deck, node, run,
    toggle(id, enabled) { node(id).change({ target: { checked: enabled } }); },
    saved: () => JSON.parse(storage.get('pt_settings')),
    sent: () => sent
  };
}

test('overtime controls change and save only their own timer without changing running clocks', () => {
  for (const [id, primary] of [['chkOver', true], ['chkOver2', false]]) {
    const h = host({ overtime: true, dualTimer: true, secondary: { overtime: true } });
    Object.assign(h.state, { running: true, endAt: 99500 });
    Object.assign(h.state.secondary, { running: true, endAt: 99000 });
    const before = structuredClone(h.state);
    h.toggle(id, false);
    const expected = structuredClone(before);
    (primary ? expected : expected.secondary).overtime = false;
    assert.deepEqual(structuredClone(h.state), expected);
    assert.equal(h.saved().overtime, !primary);
    assert.equal(h.saved().secondary.overtime, primary);
    assert.equal(h.sent(), 1);
    h.toggle(id, true);
    assert.deepEqual(structuredClone(h.state), before);
    assert.equal(h.sent(), 2);
  }
});

test('controller saves and restores opposite overtime settings and checkbox values', () => {
  for (const overtime of [false, true]) {
    const h = host();
    h.state.overtime = overtime;
    h.state.secondary.overtime = !overtime;
    h.state.secondary.running = true;
    h.state.secondary.endAt = 12345;
    h.run('saveSettings()');
    const settings = h.saved();
    assert.equal(settings.overtime, overtime);
    assert.equal(settings.secondary.overtime, !overtime);
    assert.equal(Object.hasOwn(settings.secondary, 'running'), false);
    const restored = host(settings);
    assert.equal(restored.state.overtime, overtime);
    assert.equal(restored.state.secondary.overtime, !overtime);
    assert.equal(restored.node('chkOver').checked, overtime);
    assert.equal(restored.node('chkOver2').checked, !overtime);
    assert.equal(restored.state.running, false);
    assert.equal(restored.state.secondary.running, false);
    assert.equal(restored.state.secondary.endAt, 0);
  }
});

test('controller imports legacy shared overtime once and retains independent edits after relaunch', () => {
  assert.equal(host().node('chkOver2').checked, true);
  for (const overtime of [false, true]) {
    for (const secondary of [undefined, { durationMs: 30000 }]) {
      const h = host({ overtime, secondary });
      assert.equal(h.state.secondary.overtime, overtime);
      assert.equal(h.node('chkOver2').checked, overtime);
      h.toggle('chkOver', !overtime);
      assert.equal(h.state.secondary.overtime, overtime);
      const restored = host(h.saved());
      assert.equal(restored.state.overtime, !overtime);
      assert.equal(restored.state.secondary.overtime, overtime);
    }
  }
});

test('Deck readActive exposes each timer overtime and supports legacy live states', () => {
  for (const overtime of [false, true]) {
    const h = host({ overtime, dualTimer: true, secondary: { overtime: !overtime } });
    const before = structuredClone(h.state);
    assert.equal(h.deck.readActive('t1').overtime, overtime);
    assert.equal(h.deck.readActive('t2').overtime, !overtime);
    assert.deepEqual(structuredClone(h.state), before);
    delete h.state.secondary.overtime;
    assert.equal(h.deck.readActive('t2').overtime, overtime);
  }
});

test('Deck adjustment uses the selected paused timer overtime flag in both directions', async () => {
  for (const overtime of [false, true]) {
    for (const timerId of ['t1', 't2']) {
      const h = host({ overtime, dualTimer: true, secondary: { overtime: !overtime } });
      h.state.remMs = h.state.secondary.remMs = 500;
      const before = structuredClone(h.state);
      const timer = timerId === 't1' ? h.state : h.state.secondary;
      const result = await h.deck.applyOperation({ type: 'adjust', timerId, deltaMs: -1000 });
      assert.equal(result.ok, true);
      assert.equal(timer.remMs, timer.overtime ? -500 : 0);
      assert.equal(h.sent(), 1);
      const expected = structuredClone(before);
      const changed = timerId === 't1' ? expected : expected.secondary;
      changed.remMs = timer.overtime ? -500 : 0;
      changed.durationMs -= 1000;
      assert.deepEqual(structuredClone(h.state), expected, 'Adjustment must not mutate the other timer');
    }
  }
});
