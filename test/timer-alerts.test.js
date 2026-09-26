const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const TimerAlerts = require('../timer-alerts');

function timer(durationMs = 1000) {
  return { mode: 'countdown', running: false, durationMs, remMs: durationMs, endAt: 0, soundZero: true };
}

function fixture(primary = 1000, secondary = 1000) {
  let now = 10000;
  const state = { ...timer(primary), dualTimer: true, secondary: timer(secondary) };
  const tracker = TimerAlerts.createZeroTracker();
  return {
    state,
    sample: () => tracker.sample(state, now),
    advance: ms => { now += ms; },
    start: (value = state) => { value.running = true; value.endAt = now + value.remMs; },
    pause: (value = state) => { value.remMs = value.endAt - now; value.running = false; }
  };
}

test('the same dependency-free API loads in the controller browser', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'timer-alerts.js'), 'utf8'), context);
  assert.equal(typeof context.TimerAlerts.createZeroTracker, 'function');
  assert.equal(context.TimerAlerts.createZeroTracker().sample(timer(), 0).length, 0);
});

test('both countdowns cross simultaneously exactly once without changing state', () => {
  const f = fixture();
  assert.deepEqual(f.sample(), []);
  f.start(); f.start(f.state.secondary);
  const before = structuredClone(f.state);
  f.advance(999);
  assert.deepEqual(f.sample(), []);
  f.advance(1);
  assert.deepEqual(f.sample(), ['t1', 't2']);
  assert.deepEqual(f.sample(), []);
  f.advance(50);
  assert.deepEqual(f.sample(), []);
  assert.deepEqual(f.state, before);
});

test('separate deadlines and repeated sends or reconnect snapshots stay independent', () => {
  const f = fixture(1000, 2000);
  f.start(); f.start(f.state.secondary);
  assert.deepEqual(f.sample(), []);
  f.advance(1000);
  assert.deepEqual(f.sample(), ['t1']);
  for (let i = 0; i < 5; i++) assert.deepEqual(f.sample(), []);
  f.state.secondary = { ...f.state.secondary };
  f.advance(1000);
  assert.deepEqual(f.sample(), ['t2']);
  assert.deepEqual(f.sample(), []);
});

test('all sound flag combinations emit the same crossings for host-side filtering', () => {
  for (const primarySound of [false, true]) {
    for (const secondarySound of [false, true]) {
      const f = fixture();
      f.state.soundZero = primarySound;
      f.state.secondary.soundZero = secondarySound;
      f.start(); f.start(f.state.secondary);
      assert.deepEqual(f.sample(), []);
      f.advance(1000);
      assert.deepEqual(f.sample(), ['t1', 't2']);
      f.state.soundZero = !primarySound;
      f.state.secondary.soundZero = !secondarySound;
      f.state.flashZero = false;
      f.state.separateOutputs = true;
      assert.deepEqual(f.sample(), []);
    }
  }
});

test('an initially expired running timer and later sound enable never emit', () => {
  const f = fixture(0, -1000);
  f.state.soundZero = false;
  f.state.secondary.soundZero = false;
  f.start(); f.start(f.state.secondary);
  assert.deepEqual(f.sample(), []);
  f.state.soundZero = true;
  f.state.secondary.soundZero = true;
  f.advance(1000);
  assert.deepEqual(f.sample(), []);
});

test('positive ready durations arm even if the first running sample is expired', () => {
  const f = fixture();
  assert.deepEqual(f.sample(), []);
  f.start(); f.start(f.state.secondary);
  f.advance(1001);
  assert.deepEqual(f.sample(), ['t1', 't2']);
});

test('pausing before zero preserves the crossing until resumed time runs out', () => {
  const f = fixture();
  f.start(); f.start(f.state.secondary);
  f.sample(); f.advance(400);
  f.pause(); f.pause(f.state.secondary);
  assert.deepEqual(f.sample(), []);
  f.advance(5000);
  assert.deepEqual(f.sample(), []);
  f.start(); f.start(f.state.secondary);
  f.advance(599);
  assert.deepEqual(f.sample(), []);
  f.advance(1);
  assert.deepEqual(f.sample(), ['t1', 't2']);
});

test('pausing at or beyond zero consumes the crossing without resume-negative alerts', () => {
  for (const advance of [1000, 1001]) {
    const f = fixture();
    f.start(); f.start(f.state.secondary);
    f.sample(); f.advance(advance);
    f.pause(); f.pause(f.state.secondary);
    assert.deepEqual(f.sample(), []);
    f.start(); f.start(f.state.secondary);
    assert.deepEqual(f.sample(), []);
    f.advance(1000);
    assert.deepEqual(f.sample(), []);
  }
});

test('resetting or assigning a new positive paused duration re-arms each timer', () => {
  const f = fixture();
  f.start(); f.start(f.state.secondary);
  f.sample(); f.advance(1000);
  assert.deepEqual(f.sample(), ['t1', 't2']);
  Object.assign(f.state, timer(2000));
  Object.assign(f.state.secondary, timer(3000));
  assert.deepEqual(f.sample(), []);
  f.start(); f.start(f.state.secondary);
  f.advance(2000);
  assert.deepEqual(f.sample(), ['t1']);
  f.advance(1000);
  assert.deepEqual(f.sample(), ['t2']);
});

test('LIVE adjustment into positive remaining re-arms only the adjusted timer', () => {
  const f = fixture();
  f.start(); f.start(f.state.secondary);
  f.sample(); f.advance(1500);
  assert.deepEqual(f.sample(), ['t1', 't2']);
  f.state.secondary.endAt += 2000;
  assert.deepEqual(f.sample(), []);
  f.advance(1500);
  assert.deepEqual(f.sample(), ['t2']);
  f.state.endAt -= 1000;
  assert.deepEqual(f.sample(), []);
});

test('LIVE subtraction through zero emits once for the changed running timer', () => {
  const f = fixture();
  f.start(); f.start(f.state.secondary);
  f.sample(); f.advance(500);
  f.state.endAt -= 1000;
  assert.deepEqual(f.sample(), ['t1']);
  assert.deepEqual(f.sample(), []);
  f.advance(500);
  assert.deepEqual(f.sample(), ['t2']);
});

test('countup and clock modes disarm independently and never create countdown alerts', () => {
  for (const mode of ['countup', 'clock']) {
    const f = fixture();
    f.start(); f.start(f.state.secondary);
    f.sample();
    f.state.mode = mode;
    assert.deepEqual(f.sample(), []);
    f.advance(1000);
    assert.deepEqual(f.sample(), ['t2']);
    f.state.mode = 'countdown';
    assert.deepEqual(f.sample(), []);
    f.state.endAt += 1000;
    f.sample(); f.advance(1000);
    assert.deepEqual(f.sample(), ['t1']);

    const other = fixture();
    other.state.secondary.mode = mode;
    other.start(); other.start(other.state.secondary);
    other.sample(); other.advance(1000);
    assert.deepEqual(other.sample(), ['t1']);
  }
});

test('disabling secondary disarms it and enabling an expired secondary is silent', () => {
  const f = fixture();
  f.start(); f.start(f.state.secondary);
  f.sample();
  f.state.dualTimer = false;
  assert.deepEqual(f.sample(), []);
  f.advance(1000);
  assert.deepEqual(f.sample(), ['t1']);
  f.state.dualTimer = true;
  assert.deepEqual(f.sample(), []);
  f.state.secondary.endAt += 500;
  assert.deepEqual(f.sample(), []);
  f.advance(500);
  assert.deepEqual(f.sample(), ['t2']);
});

test('secondary enabled while still positive arms for its future crossing', () => {
  const f = fixture();
  f.state.dualTimer = false;
  f.start(); f.start(f.state.secondary);
  f.sample(); f.advance(500);
  f.state.dualTimer = true;
  assert.deepEqual(f.sample(), []);
  f.advance(500);
  assert.deepEqual(f.sample(), ['t1', 't2']);
});

test('large forward time jumps cross both timers once and repeated overtime is silent', () => {
  const f = fixture(1000, 3600000);
  f.start(); f.start(f.state.secondary);
  f.sample(); f.advance(48 * 3600000);
  assert.deepEqual(f.sample(), ['t1', 't2']);
  f.advance(48 * 3600000);
  assert.deepEqual(f.sample(), []);
});

test('host-corrected wall-clock jumps preserve remaining time and future crossings', () => {
  const f = fixture();
  f.start(); f.start(f.state.secondary);
  f.sample();
  for (const jump of [3600000, -7200000]) {
    f.advance(jump);
    f.state.endAt += jump;
    f.state.secondary.endAt += jump;
    assert.deepEqual(f.sample(), []);
  }
  f.advance(1000);
  assert.deepEqual(f.sample(), ['t1', 't2']);
});

test('missing or invalid clock observations disarm without corrupting the next run', () => {
  const tracker = TimerAlerts.createZeroTracker();
  const state = { ...timer(), dualTimer: true, secondary: timer() };
  tracker.sample(state, 0);
  assert.deepEqual(tracker.sample(null, 0), []);
  Object.assign(state, { running: true, endAt: 0 });
  Object.assign(state.secondary, { running: true, endAt: 0 });
  assert.deepEqual(tracker.sample(state, 1), []);
  state.endAt = Infinity;
  state.secondary.endAt = NaN;
  assert.deepEqual(tracker.sample(state, 2), []);
  state.endAt = 100;
  state.secondary.endAt = 100;
  assert.deepEqual(tracker.sample(state, 3), []);
  assert.deepEqual(tracker.sample(state, 100), ['t1', 't2']);
});
