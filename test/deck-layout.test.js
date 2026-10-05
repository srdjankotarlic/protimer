const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Layout = require('../deck-layout');
function previewLayout(kind='standard') {
  const board=Layout.defaultLayout(kind);
  board.slots.slice(8,14).forEach((key,i)=>Object.assign(key,{step:i%2?1:-1,unit:['h','m','s'][Math.floor(i/2)],target:'set',timerId:'selected'}));
  return board;
}

test('Standard 28 starter contains exactly four genuine null free slots', () => {
  const layout = Layout.defaultLayout();
  assert.equal(layout.slots.length, 32); assert.equal(Layout.validate(layout).ok, true);
  assert.deepEqual(layout.slots.map((key, i) => key === null ? i : -1).filter(i => i !== -1), [7, 15, 23, 31]);
  assert.deepEqual(layout.slots.slice(0, 7).map(k => k.command), ['startSet', 'pause', 'start', 'activeTime', 'setTime', 'reset', 'bell']);
  assert.ok(layout.slots.slice(8,14).every(k=>k.target==='live'&&k.timerId==='t1'&&k.pressPolicy==='short'));
  assert.deepEqual(layout.slots.slice(24,26).map(k=>k.timerId),['t1','t2']);
  assert.ok(layout.slots.slice(26,28).every(k=>k.outputAction==='open'));
  assert.deepEqual(layout.slots.slice(8, 14).map(Layout.label), ['−10m', '+10m', '−5m', '+5m', '−1m', '+1m']);
  assert.deepEqual(layout.slots.slice(16, 21).map(k => k.durationMs), [300000, 600000, 900000, 1800000, 3600000]);
  assert.equal(layout.slots[30].command, 'clearSet', 'a manual profile cannot promise BACK, so the starter key clears only SET');
  assert.equal(new Set(layout.slots.filter(Boolean).map(k => k.id)).size, 28);
});

test('Full 32 adds only implemented catalog commands and no false free placeholders', () => {
  const layout = Layout.defaultLayout('full'); assert.equal(layout.slots.filter(Boolean).length, 32);
  assert.deepEqual([7, 15, 23, 31].map(i => layout.slots[i].command), ['loadSet', 'liveT1', 'liveBoth', 'liveT2']);
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

test('native one-touch starter accepts short RESET and BLACK without changing legacy policies', () => {
  for (const command of ['reset', 'blackout']) {
    assert.equal(Layout.defaultKey(command).pressPolicy, 'short');
    assert.equal(Layout.validateKey(Layout.defaultKey(command, { pressPolicy: 'short' })).ok, true);
    assert.equal(Layout.validateKey(Layout.defaultKey(command, { pressPolicy: 'confirm' })).ok, true);
  }
  assert.equal(Layout.defaultKey('startSet').pressPolicy, 'short');
  assert.equal(Layout.validateKey(Layout.defaultKey('startSet')).ok, true);
});

test('only an untouched legacy starter layout receives the ergonomic key update', () => {
  const old = previewLayout();
  ['startPause','startSet','activeTime','setTime','editTarget','reset','bell'].forEach((command,i)=>{old.slots[i]=Layout.defaultKey(command,{id:`protimer-slot-${i+1}`});});
  ['blackout','outputA','outputB','selectTimer','message','settings','back'].forEach((command,i)=>{old.slots[24+i]=Layout.defaultKey(command,{id:`protimer-slot-${25+i}`});});
  old.slots.slice(8,14).forEach(key=>{key.target='selected';});old.slots[1].pressPolicy='hold';
  old.slots[24].timerId='selected';old.slots[25].timerId='selected';old.slots[26].outputAction='toggle';old.slots[27].outputAction='toggle';
  old.slots[5].pressPolicy='hold';old.slots[24].pressPolicy='hold';
  const migrated = Layout.migrate(old);
  assert.equal(migrated.slots[0].command, 'startSet');
  assert.equal(migrated.slots[0].pressPolicy, 'short');
  assert.equal(migrated.slots[30].command, 'clearSet');
  old.slots[4].name = 'My show';
  const custom = Layout.migrate(old);
  assert.equal(custom.slots[1].pressPolicy, 'hold');
  assert.equal(custom.slots[30].command, 'back');
});

test('only untouched previous starter hold settings migrate to one-touch defaults', () => {
  const old=previewLayout();old.slots[28]=Layout.defaultKey('blackout',{id:'protimer-slot-29'});old.slots[29]=Layout.defaultKey('message',{id:'protimer-slot-30'});old.slots[5].pressPolicy='hold';old.slots[28].pressPolicy='hold';
  old.slots[2]=Layout.defaultKey('resume',{id:'protimer-slot-3'});
  assert.equal(Layout.migrate(old).slots[5].pressPolicy,'short');
  old.slots[5].name='Show reset';
  assert.equal(Layout.migrate(old).slots[5].name,'Show reset');
  assert.equal(Layout.migrate(old).slots[5].pressPolicy,'hold');
});

test('untouched one-touch starter migrates BLACK into separate ON and RESTORE commands',()=>{
  const old=previewLayout();old.slots[28]=Layout.defaultKey('blackout',{id:'protimer-slot-29'});old.slots[29]=Layout.defaultKey('message',{id:'protimer-slot-30'});
  old.slots[2]=Layout.defaultKey('resume',{id:'protimer-slot-3'});
  const updated=Layout.migrate(old);
  assert.equal(updated.slots[28].command,'blackoutOn');assert.equal(updated.slots[29].command,'blackoutOff');
  old.slots[29].name='Speaker message';assert.equal(Layout.migrate(old).slots[29].command,'message','custom shows are preserved');
});

test('untouched current starter gains PLAY ACTIVE while custom RESUME keys are preserved',()=>{
  const old=previewLayout();old.slots[2]=Layout.defaultKey('resume',{id:'protimer-slot-3'});
  assert.equal(Layout.migrate(old).slots[2].command,'start');
  old.slots[2].name='Resume show';assert.equal(Layout.migrate(old).slots[2].command,'resume');
});

test('untouched preview starters gain the dedicated T1 LIVE row but customized SET keys are preserved',()=>{
  for(const kind of ['standard','full']) {
    const old=previewLayout(kind);
    assert.deepEqual(Layout.migrate(old),Layout.defaultLayout(kind));
    old.slots[8].name='Prepare next speaker';
    assert.deepEqual(Layout.migrate(old),old);
    assert.equal(Layout.migrate(old).slots[8].target,'set');
  }
});

test('layout undo/redo and restore are detached data and do not erase named files', () => {
  const first = Layout.defaultLayout(), history = Layout.createHistory(first);
  const change = history.current(); change.name = 'Show A'; change.slots[0] = Layout.defaultKey('empty'); history.commit(change);
  const restored = Layout.defaultLayout(); history.commit(restored);
  assert.equal(history.undo().name, 'Show A'); assert.equal(history.undo().name, first.name);
  assert.equal(history.redo().name, 'Show A'); assert.equal(history.redo().name, restored.name);
  const detached = history.current(); detached.slots[0].command = 'shell';
  assert.equal(history.current().slots[0].command, 'startSet');
  assert.equal(first.slots[0].command, 'startSet');
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
