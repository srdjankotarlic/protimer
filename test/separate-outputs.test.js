const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const TimerTools = require('../timer-tools');
const createOutput = require('../secondary-output');

function fixture() {
  const primary = { id: 1, bounds: { x: 0, y: 0, width: 1600, height: 900 }, workArea: { x: 0, y: 0, width: 1600, height: 900 }, scaleFactor: 1 };
  const tv1 = { ...primary, id: 2, bounds: { x: 1600, y: 0, width: 1920, height: 1080 }, workArea: { x: 1600, y: 0, width: 1920, height: 1080 } };
  const tv2 = { ...primary, id: 3, bounds: { x: -1920, y: 0, width: 1920, height: 1080 }, workArea: { x: -1920, y: 0, width: 1920, height: 1080 } };
  let displays = [primary, tv1, tv2];
  let state = { dualTimer: true, separateOutputs: true, secondary: TimerTools.secondary({ durationMs: 330000 }) };
  const windows = [];
  class Window extends EventEmitter {
    constructor(options) {
      super(); this.options = options; this.bounds = { x: 0, y: 0, width: 900, height: 506 };
      this.webContents = new EventEmitter(); this.sent = [];
      this.webContents.send = (channel, data) => this.sent.push({ channel, data });
      windows.push(this);
    }
    isDestroyed() { return !!this.dead; }
    destroy() { this.dead = true; this.emit('closed'); }
    isFullScreen() { return !!this.fullscreen; }
    setFullScreen(v) { this.fullscreen = v; this.emit(v ? 'enter-full-screen' : 'leave-full-screen'); }
    setBounds(b) { this.bounds = b; this.emit('move'); this.emit('resize'); }
    getBounds() { return this.bounds; }
    setContentSize(width, height) { this.bounds = { ...this.bounds, width, height }; this.emit('resize'); }
    getContentSize() { return [this.bounds.width, this.bounds.height]; }
    setAlwaysOnTop() {}
    show() { this.shown = true; }
    loadFile() { setImmediate(() => { this.webContents.emit('did-finish-load'); this.emit('ready-to-show'); }); }
  }
  const screen = {
    getAllDisplays: () => displays,
    getDisplayMatching: bounds => displays.find(d => bounds.x >= d.bounds.x && bounds.x < d.bounds.x + d.bounds.width) || primary
  };
  const output = createOutput({ BrowserWindow: Window, screen, getState: () => state, controlDisplayId: () => 1, changed() {} });
  return { output, windows, getState: () => state, setState: s => { state = s; }, setDisplays: d => { displays = d; }, primary, tv1, tv2 };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('combined output keeps every existing state field; separate views never mutate clocks', () => {
  const original = { mode: 'countup', durationMs: 600000, remMs: 590000, running: true, endAt: 1000000,
    dualTimer: true, dualSplit: 'rows', separateOutputs: false, outputLayout: { scale: 90, x: 5, y: -3 },
    text: 'Welcome', textOnly: true, showNowNext: true, blackout: true, message: { text: 'Wrap up' },
    secondary: { ...TimerTools.secondary({ durationMs: 330000 }), running: true, endAt: 900000, layout: { scale: 70, x: -7, y: 2 } } };
  assert.equal(TimerTools.outputState(original), original);
  original.separateOutputs = true;
  const before = structuredClone(original);
  const first = TimerTools.outputState(original), second = TimerTools.outputState(original, 'secondary');
  assert.equal(first.dualTimer, false); assert.equal(first.mode, 'countup');
  assert.equal(first.textOnly, true); assert.equal(first.showNowNext, true);
  assert.equal(second.dualTimer, false); assert.equal(second.mode, 'countdown');
  assert.equal(second.durationMs, 330000); assert.equal(second.endAt, 900000);
  assert.equal(second.running, true); assert.equal(second.blackout, true);
  assert.deepEqual(second.message, original.message);
  assert.deepEqual(second.outputLayout, original.secondary.layout);
  assert.equal(second.text, ''); assert.equal(second.textOnly, false); assert.equal(second.showNowNext, false);
  assert.deepEqual(original, before);
});
test('separate mode does not open a screen until explicitly sent, and rejects missing displays', async () => {
  const f = fixture();
  f.output.update({}); assert.equal(f.windows.length, 0);
  assert.equal(f.output.open(999).ok, false); assert.equal(f.windows.length, 0);
  f.setState({ ...f.getState(), separateOutputs: false });
  assert.equal(f.output.open(3).ok, false);
});
test('second window targets TV 2, preserves its own clock, and moves only when sent', async () => {
  const f = fixture();
  assert.equal(f.output.open(3).ok, true); await tick(); await tick();
  const win = f.output.getWindow();
  assert.equal(win.options.frame, false); assert.equal(win.options.resizable, true);
  assert.deepEqual(win.bounds, f.tv2.bounds); assert.equal(win.fullscreen, true);
  assert.equal(win.sent.find(m => m.channel === 'state').data.durationMs, 330000);
  f.setDisplays([f.primary, f.tv1, f.tv2, { ...f.primary, id: 4 }]);
  f.output.displaysChanged(); assert.deepEqual(win.bounds, f.tv2.bounds);
  f.output.open(2); await tick(); await tick();
  assert.equal(f.windows.length, 1); assert.deepEqual(win.bounds, f.tv1.bounds);
  f.output.close();
});
test('unplugging selected display closes only its output; changing mode never changes timer', async () => {
  const f = fixture(); f.output.open(3); await tick(); await tick();
  const before = structuredClone(f.getState());
  f.setDisplays([f.primary, f.tv1]); f.output.displaysChanged();
  assert.equal(f.output.getWindow(), null); assert.deepEqual(f.getState(), before);
  f.setDisplays([f.primary, f.tv1, f.tv2]); f.output.displaysChanged();
  assert.equal(f.output.getWindow(), null);
  f.output.open(3); await tick(); await tick();
  f.setState({ ...f.getState(), separateOutputs: false }); f.output.update(before);
  assert.equal(f.output.getWindow(), null); assert.deepEqual(f.getState().secondary, before.secondary);
});
test('native relocation after unplugging cannot reassign the disconnected TV', async () => {
  const f = fixture(); f.output.open(3); await tick(); await tick();
  f.setDisplays([f.primary, f.tv1]);
  f.output.getWindow().setBounds(f.primary.bounds);
  f.output.displaysChanged(); assert.equal(f.output.getWindow(), null);
});
test('rapid display selection before first paint uses the latest explicit target', async () => {
  const f = fixture(); f.output.open(3); f.output.open(2);
  f.output.getWindow().setBounds(f.primary.bounds); // initial native placement
  await tick(); await tick();
  assert.deepEqual(f.output.getWindow().getBounds(), f.tv1.bounds);
  f.output.close();
});
test('secondary resolution and transparency are independent and invalid sizes are rejected', async () => {
  const f = fixture();
  f.setState({ ...f.getState(), outputSize: { width: 1920, height: 1080 }, secondary: { ...f.getState().secondary, outputSize: { width: 800, height: 600 } } });
  f.output.open(3); await tick(); await tick();
  assert.deepEqual(f.output.getWindow().getContentSize(), [800, 600]);
  assert.equal((await f.output.resize({ width: 0, height: 400 })).ok, false);
  assert.equal((await f.output.resize({ width: 1000, height: 500 })).ok, true);
  assert.deepEqual(f.getState().outputSize, { width: 1920, height: 1080 });
  const previous = f.getState(); f.setState({ ...previous, transparent: true }); f.output.update(previous);
  await tick(); await tick();
  assert.equal(f.output.geometry().displayId, 3); assert.equal(f.output.getWindow().options.transparent, true);
  f.output.close();
});
test('each desktop projection keeps its own grid, combined/network state remains untouched', () => {
  const state = { dualTimer: true, separateOutputs: true, gridOn: true, gridSize: 3, gridCell: 8,
    secondary: TimerTools.secondary({ gridOn: true, gridSize: 5, gridCell: 0 }) };
  const before = structuredClone(state);
  assert.deepEqual(TimerTools.grid(TimerTools.outputState(state)), { gridOn: true, gridSize: 3, gridCell: 8 });
  assert.deepEqual(TimerTools.grid(TimerTools.outputState(state, 'secondary')), { gridOn: true, gridSize: 5, gridCell: 0 });
  assert.deepEqual(state, before);
  state.separateOutputs = false;
  assert.equal(TimerTools.outputState(state), state);
  assert.deepEqual(TimerTools.grid(state.secondary), { gridOn: true, gridSize: 5, gridCell: 0 });
});
test('secondary grid uses its own display and ignores every primary grid change', async () => {
  const f = fixture();
  f.setState({ ...f.getState(), gridOn: true, gridSize: 3, gridCell: 8,
    secondary: TimerTools.secondary({ gridOn: true, gridSize: 5, gridCell: 6 }) });
  f.output.open(3); await tick(); await tick();
  const win = f.output.getWindow();
  assert.deepEqual(win.bounds, { x: -1536, y: 216, width: 384, height: 216 });
  const before = win.bounds, revision = f.output.getRevision();
  const previous = f.getState();
  f.setState({ ...previous, gridOn: false, gridSize: 9, gridCell: 80 });
  f.output.update(previous); await tick(); await tick();
  assert.deepEqual(win.bounds, before);
  assert.equal(f.output.getRevision(), revision, 'Primary grid edit must not even schedule a secondary placement');
  const prev2 = f.getState();
  f.setState({ ...prev2, secondary: { ...prev2.secondary, gridSize: 3, gridCell: 8 } });
  f.output.update(prev2); await tick(); await tick();
  assert.deepEqual(win.bounds, { x: -640, y: 720, width: 640, height: 360 });
  assert.equal(f.getState().gridOn, false);
  f.output.close();
});
test('secondary free sizing and manual placement work while the primary grid is on', async () => {
  const f = fixture();
  f.setState({ ...f.getState(), gridOn: true, gridSize: 9, gridCell: 80 });
  f.output.open(1); await tick(); await tick();
  assert.equal((await f.output.resize({ width: 800, height: 450 })).ok, true);
  const win = f.output.getWindow();
  const dragged = { x: 1700, y: 100, width: 800, height: 450 };
  win.setBounds(dragged);
  assert.equal(f.output.geometry().displayId, 2);
  const previous = f.getState();
  f.setState({ ...previous, gridCell: 0 }); f.output.update(previous); await tick();
  assert.deepEqual(win.bounds, dragged);
  const prev2 = f.getState();
  f.setState({ ...prev2, secondary: { ...prev2.secondary, gridOn: true, gridSize: 3, gridCell: 0 } });
  f.output.update(prev2); await tick(); await tick();
  assert.deepEqual(win.bounds, { x: 1600, y: 0, width: 640, height: 360 });
  assert.equal((await f.output.resize({ width: 800, height: 450 })).ok, false, 'Own grid must still guard automatic sizing');
  f.output.close();
});
