const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Layout = require('../deck-layout');

test('Standard 28 starter contains exactly four genuine null free slots', () => {
  const layout = Layout.defaultLayout();
  assert.equal(layout.slots.length, 32); assert.equal(Layout.validate(layout).ok, true);
  assert.deepEqual(layout.slots.map((key, i) => key === null ? i : -1).filter(i => i !== -1), [7, 15, 23, 31]);
  assert.deepEqual(layout.slots.slice(0, 7).map(k => k.command), ['startPause', 'startSet', 'activeTime', 'setTime', 'editTarget', 'reset', 'bell']);
  assert.deepEqual(layout.slots.slice(8, 14).map(Layout.label), ['−1h', '+1h', '−1m', '+1m', '−1s', '+1s']);
  assert.deepEqual(layout.slots.slice(16, 21).map(k => k.durationMs), [300000, 600000, 900000, 1800000, 3600000]);
  assert.equal(new Set(layout.slots.filter(Boolean).map(k => k.id)).size, 28);
});

test('Full 32 adds only implemented catalog commands and no false free placeholders', () => {
  const layout = Layout.defaultLayout('full'); assert.equal(layout.slots.filter(Boolean).length, 32);
  assert.deepEqual([7, 15, 23, 31].map(i => layout.slots[i].command), ['prev', 'next', 'loadSelected', 'fullscreen']);
  assert.equal(Layout.validate(layout).ok, true);
  const empty = Layout.defaultKey('empty'); assert.ok(empty); assert.equal(Layout.label(empty), 'INACTIVE SLOT');
  assert.equal(Layout.label(null), 'FREE');
});

test('custom adjustment labels and presets reflect actual values and units', () => {
  assert.equal(Layout.label(Layout.defaultKey('adjust', { step: -30, unit: 's' })), '−30s');
  assert.equal(Layout.label(Layout.defaultKey('adjust', { step: 5, unit: 'm' })), '+5m');
  assert.equal(Layout.label(Layout.defaultKey('preset', { durationMs: 75000 })), '1:15');
  assert.equal(Layout.label(Layout.defaultKey('preset', { name: 'BREAK', durationMs: 300000 })), 'BREAK');
});

test('strict JSON validation rejects unknown fields and arbitrary icon/code/URL content', () => {
  for (const field of ['token', 'sessionToken', 'shell', '__proto__', 'endpoint', 'script']) {
    const layout = JSON.parse(JSON.stringify(Layout.defaultLayout()));
    Object.defineProperty(layout, field, { value: 'not allowed', enumerable: true });
    assert.equal(Layout.validate(layout).ok, false, field);
  }
  for (const patch of [{ icon: '<svg onload="run()"/>' }, { icon: 'https://example.com/icon.png' }, { command: 'eval' },
    { timerId: 'all' }, { target: 'automatic' }, { color: 'url(https://example.com)' }, { name: 'x\u0000y' },
    { durationMs: -1 }, { durationMs: 359999001 }, { durationMs: 1.5 }, { step: 100, unit: 'h' },
    { textSize: 1 }, { textSize: 29 }, { stateDisplay: 'true' }, { token: 'not exportable' }]) {
    assert.equal(Layout.validateKey({ ...Layout.defaultKey('adjust'), ...patch }).ok, false, JSON.stringify(patch));
  }
});

test('validation preserves names safely as data, stable identities, and rejects duplicate ids', () => {
  const layout = Layout.defaultLayout(); layout.slots[0].name = '<play & pause>';
  assert.equal(Layout.normalize(layout).slots[0].name, '<play & pause>');
  const id = layout.slots[0].id; [layout.slots[0], layout.slots[1]] = [layout.slots[1], layout.slots[0]];
  assert.equal(Layout.normalize(layout).slots[1].id, id);
  layout.slots[2].id = id; assert.equal(Layout.validate(layout).ok, false);
});

test('hotkeys are normalized and conflicts cannot silently apply', () => {
  const layout = Layout.defaultLayout(); layout.slots[0].hotkey = 'shift+ctrl+K';
  assert.equal(Layout.normalize(layout).slots[0].hotkey, 'Ctrl+Shift+K');
  layout.slots[6].hotkey = 'Ctrl+Shift+k'; assert.equal(Layout.validate(layout).ok, false);
  for (const hotkey of ['Ctrl+Ctrl+A', 'Ctrl+', 'shell+R', 'Alt+InvalidKey']) assert.throws(() => Layout.normalizeHotkey(hotkey));
  assert.equal(Layout.normalizeHotkey('Space'), 'Space'); // Local only. Global policy belongs to the OS adapter.
  assert.equal(Layout.validateKey(Layout.defaultKey('activeTime', { hotkey: 'A' })).ok, false);
});

test('protected controls cannot become accidental short presses through import', () => {
  for (const command of ['reset', 'blackout', 'startSet']) {
    assert.equal(Layout.defaultKey(command).pressPolicy, 'hold');
    assert.equal(Layout.validateKey(Layout.defaultKey(command, { pressPolicy: 'short' })).ok, false);
    assert.equal(Layout.validateKey(Layout.defaultKey(command, { pressPolicy: 'confirm' })).ok, true);
  }
});

test('layout undo/redo and restore are detached data and do not erase named files', () => {
  const first = Layout.defaultLayout(), history = Layout.createHistory(first);
  const change = history.current(); change.name = 'Show A'; change.slots[0] = Layout.defaultKey('empty'); history.commit(change);
  const restored = Layout.defaultLayout(); history.commit(restored);
  assert.equal(history.undo().name, 'Show A'); assert.equal(history.undo().name, first.name);
  assert.equal(history.redo().name, 'Show A'); assert.equal(history.redo().name, restored.name);
  const detached = history.current(); detached.slots[0].command = 'shell';
  assert.equal(history.current().slots[0].command, 'startPause');
  assert.equal(first.slots[0].command, 'startPause');
});

test('schema migrations are bounded and future versions are not guessed', () => {
  const layout = Layout.defaultLayout(); assert.equal(Layout.migrate({ ...layout, schemaVersion: 0 }).schemaVersion, 1);
  assert.throws(() => Layout.migrate({ ...layout, schemaVersion: 2 }), /schemaVersion/);
  assert.throws(() => Layout.normalize({ ...layout, slots: layout.slots.slice(1) }), /32 slots/);
});

test('layout browser UMD export needs no Node or external runtime dependency', () => {
  const context = vm.createContext({}); vm.runInContext(fs.readFileSync(require.resolve('../deck-layout'), 'utf8'), context);
  assert.equal(typeof context.DeckLayout.defaultLayout, 'function');
  assert.equal(context.ProTimerDeckLayout, context.DeckLayout);
  assert.equal(context.DeckLayout.defaultLayout().slots.length, 32);
});
