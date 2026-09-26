const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const TimerTools = require('../timer-tools');

const root = path.join(__dirname, '..');
const controller = fs.readFileSync(path.join(root, 'controller.html'), 'utf8');
function section(start, end) {
  const first = controller.indexOf(start);
  const last = controller.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Controller section exists: ${start}`);
  return controller.slice(first, last);
}

// Run the real controller functions and checkbox handlers, replacing only their
// surrounding UI/IPC dependencies. No interval runs unless the test invokes it.
function host() {
  let wall = 10000, mono = 0, bells = 0;
  const nodes = new Map();
  const timer = () => ({ mode: 'countdown', running: true, durationMs: 1000,
    endAt: wall + 1000, remMs: 1000, elapsedMs: 0, soundZero: false });
  const state = { ...timer(), dualTimer: true, secondary: timer() };
  const context = vm.createContext({ S: state, TimerTools, cues: [], currentCue: -1,
    zeroFired: false, autoNext: false, autoAdvanceTimer: null, targetArmed: false,
    Date: { now: () => wall }, performance: { now: () => mono },
    ProTimerDeckAudio: () => ({}), showZeroAudioError() {}, beep() { bells++; },
    api: { sendState() {}, onClockPower() {} }, syncDurationDisplays() {},
    saveSettings() {}, updateButtons() {}, cancelAutoAdvance() {}, clearTargetArm() {},
    $: id => {
      if (!nodes.has(id)) nodes.set(id, {
        addEventListener(event, handler) { this[event] = handler; }
      });
      return nodes.get(id);
    }
  });
  for (const file of ['timer-alerts.js', 'engine-clock.js'])
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  for (const [start, end] of [
    ['let deckControl=null;', '// ---------- RASPORED'],
    ['function tickCountdown(){', 'function reset(){'],
    ['function secondaryRunning(running){', 'function secondaryDuration(ms){'],
    ['function primaryRunning(running){', 'function syncDualUI(){'],
    ['function setZeroSound(', "$('chkSound').addEventListener"]
  ]) vm.runInContext(section(start, end), context, { filename: 'controller.html' });
  for (const id of ['chkSound', 'chkSound2']) {
    const handler = controller.split('\n').find(line => line.startsWith(`$('${id}').addEventListener`));
    assert.ok(handler, `Real ${id} handler exists`);
    vm.runInContext(handler, context, { filename: 'controller.html' });
  }
  return {
    state,
    run: code => vm.runInContext(code, context),
    advance(ms, monotonicMs = ms) { wall += ms; mono += monotonicMs; },
    toggle(id, enabled) { nodes.get(id).change({ target: { checked: enabled } }); },
    bellCount: () => bells,
    remaining: value => value.endAt - wall
  };
}

test('enabling either zero sound after expiry but before the next tick never rings late', () => {
  for (const id of ['chkSound', 'chkSound2']) {
    const h = host();
    h.run('send()');
    h.advance(1001);
    h.toggle(id, true);
    assert.equal(h.bellCount(), 0, `${id} must consume expiry with the previous sound setting`);
    assert.equal((id === 'chkSound' ? h.state : h.state.secondary).soundZero, true);
    h.run('tickCountdown();send()');
    assert.equal(h.bellCount(), 0);
  }
});

test('sound enabled while countdown is positive still rings once at its future crossing', () => {
  for (const id of ['chkSound', 'chkSound2']) {
    const h = host();
    h.run('send()');
    h.advance(500);
    h.toggle(id, true);
    assert.equal(h.bellCount(), 0);
    h.advance(500);
    h.run('tickCountdown();send()');
    assert.equal(h.bellCount(), 1);
  }
});

test('a state send corrects a wall-clock jump before checking countdown crossings', () => {
  const h = host();
  h.state.soundZero = h.state.secondary.soundZero = true;
  h.run('send()');
  h.advance(3600000, 100);
  h.run('send()');
  assert.equal(h.bellCount(), 0, 'A settings send must not treat a corrected clock jump as zero');
  assert.equal(h.remaining(h.state), 900);
  assert.equal(h.remaining(h.state.secondary), 900);
  h.run('tickCountdown()');
  h.advance(900);
  h.run('tickCountdown();send();tickCountdown()');
  assert.equal(h.bellCount(), 1, 'The real crossing emits one shared bell');
});

test('pause both at expiry consumes both crossings before sending and resuming stays silent', () => {
  const h = host();
  h.state.soundZero = h.state.secondary.soundZero = true;
  h.run('send()');
  h.advance(1001);
  h.run('bothRunning(false)');
  assert.equal(h.bellCount(), 0, 'Pausing T1 must not send while T2 is still running');
  assert.equal(h.state.running, false);
  assert.equal(h.state.secondary.running, false);
  assert.equal(h.state.remMs, -1);
  assert.equal(h.state.secondary.remMs, -1);
  h.run('bothRunning(true);tickCountdown();send()');
  assert.equal(h.bellCount(), 0);
});
