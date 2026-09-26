const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Model = require('../deck-model');

function harness(overrides = {}) {
  let time = 100000, monotonic = 0, serial = 0;
  const clocks = Object.fromEntries(['t1', 't2'].map(id => [id, { mode: 'countdown', durationMs: 600000,
    remMs: 600000, endAt: 0, elapsedMs: 0, startAt: 0, running: false, enabled: true, overtime: true }]));
  const operations = [], saved = [];
  const applyOperation = op => {
    operations.push(op); const active = clocks[op.timerId];
    if (op.type === 'startSet') Object.assign(active, { mode: op.mode, durationMs: op.durationMs, remMs: op.durationMs,
      elapsedMs: 0, startAt: time, endAt: time + op.durationMs, running: op.mode !== 'clock' });
    else if (op.type === 'start' || op.type === 'resume') Object.assign(active, { running: true, startAt: time, endAt: time + active.remMs });
    else if (op.type === 'pause') {
      if (active.mode === 'countup') active.elapsedMs += time - active.startAt;
      else active.remMs = active.endAt - time;
      active.running = false;
    } else if (op.type === 'reset') Object.assign(active, { running: false, durationMs: op.durationMs, remMs: op.durationMs, elapsedMs: 0, endAt: 0 });
    else if (op.type === 'adjust') {
      if (active.running) active.endAt += op.deltaMs;
      else active.remMs = Math.max(0, active.remMs + op.deltaMs);
      active.durationMs = Math.max(1000, active.durationMs + op.deltaMs);
    } else if (op.type === 'loadSelected') return { ok: true, cue: { durationMs: 75000 } };
    return { ok: true };
  };
  const model = Model.create({ readActive: id => clocks[id], applyOperation,
    now: () => time, guardNow: () => monotonic, onChange: (_, value) => saved.push(value), ...overrides });
  const command = (type, timerId = 't1', payload, extra = {}) => ({ commandId: `test-${++serial}`, type, timerId,
    ...(payload === undefined ? {} : { payload }), ...extra });
  const ctx = { sourceId: 'plugin', sessionId: 'session-1', deviceId: 'xl-1', connected: true };
  const send = (type, timerId = 't1', payload, extra = {}, context = ctx) => model.dispatch(command(type, timerId, payload, extra), context);
  const startSet = (id = 't1') => { const state = model.snapshot().timers[id]; return command('startSet', id, undefined,
    { expectedActiveVersion: state.active.version, expectedDraftVersion: state.draft.version }); };
  return { model, clocks, operations, saved, command, send, ctx, startSet, advance(ms) { time += ms; monotonic += ms; },
    jumpWall(ms) { time += ms; }, advanceMonotonic(ms) { monotonic += ms; } };
}

test('deck modules are browser UMD as well as CommonJS, without a client timer engine', () => {
  const ctx = vm.createContext({ performance: { now: () => 0 } });
  vm.runInContext(fs.readFileSync(require.resolve('../deck-model'), 'utf8'), ctx);
  assert.equal(typeof ctx.DeckModel.create, 'function');
  assert.equal(ctx.ProTimerDeckModel, ctx.DeckModel);
  assert.throws(() => Model.create({}), /authoritative timer adapter/);
});

test('SET adjustments and presets never mutate a running ACTIVE or the other timer', async () => {
  const h = harness(); await h.send('start'); h.advance(77000);
  const raw = structuredClone(h.clocks), before = h.model.snapshot();
  assert.equal(before.timers.t1.active.remainingMs, 523000);
  await h.send('preset', 't1', { durationMs: 900000 });
  await h.send('adjust', 't1', { step: 1, unit: 'm', target: 'set' });
  assert.equal(h.model.snapshot().timers.t1.draft.durationMs, 960000);
  assert.deepEqual(h.clocks, raw);
  assert.equal(h.model.snapshot().timers.t1.active.version, before.timers.t1.active.version);
  assert.equal(h.model.snapshot().timers.t2.draft.durationMs, 600000);
  assert.equal(h.operations.length, 1);
  assert.deepEqual(h.saved.at(-1).drafts.t1, { mode: 'countdown', durationMs: 960000 });
});

test('optional held commands also cancel on release and device change', async () => {
  const h=harness(),command=h.command('bell');
  const press=h.model.beginPress(command,h.ctx);h.advance(1600);
  h.model.cancelPress(press.pressId,h.ctx);
  assert.equal((await h.model.dispatch({...command,pressId:press.pressId},h.ctx)).code,'HOLD_REQUIRED');
  assert.equal(h.operations.length,0);
});

test('START SET requires displayed versions and applies one atomic operation, deduplicated', async () => {
  const h = harness(); await h.send('preset', 't1', { durationMs: 60000 });
  assert.equal((await h.send('startSet')).code, 'VERSION_REQUIRED');
  const command = h.startSet();
  const [a, b] = await Promise.all([h.model.dispatch(command, h.ctx), h.model.dispatch(command, h.ctx)]);
  assert.equal(a.ok, true); assert.deepEqual(a, b);
  assert.equal(h.operations.length, 1);
  assert.deepEqual(h.operations[0], { type: 'startSet', timerId: 't1', mode: 'countdown', durationMs: 60000, commandId: command.commandId });
  assert.equal(h.model.snapshot().timers.t1.active.status, 'RUNNING');
  assert.equal((await h.model.dispatch({ ...command, timerId: 't2' }, h.ctx)).code, 'COMMAND_ID_REUSED');
});

test('running or paused ACTIVE replacement needs a real server-timed hold', async () => {
  const h = harness(); await h.send('start'); await h.send('preset', 't1', { durationMs: 900000 });
  assert.equal((await h.model.dispatch(h.startSet(), h.ctx)).code, 'HOLD_REQUIRED');
  let command = h.startSet(), press = h.model.beginPress(command, h.ctx);
  h.advance(1499);
  assert.equal((await h.model.dispatch({ ...command, pressId: press.pressId }, h.ctx)).code, 'HOLD_REQUIRED');
  command = h.startSet(); press = h.model.beginPress(command, h.ctx); h.advance(1500);
  assert.equal((await h.model.dispatch({ ...command, pressId: press.pressId }, h.ctx)).ok, true);
  assert.equal(h.clocks.t1.durationMs, 900000);
  await h.send('pause');
  assert.equal(h.model.snapshot().timers.t1.active.status, 'PAUSED');
  assert.equal((await h.model.dispatch(h.startSet(), h.ctx)).code, 'HOLD_REQUIRED');
});

test('guard is bound to source, device, command, target and displayed versions; keyUp cancels', async () => {
  const h = harness(); await h.send('start');
  const command = h.startSet(), press = h.model.beginPress(command, h.ctx); h.advance(1600);
  assert.equal((await h.model.dispatch({ ...command, pressId: press.pressId }, { ...h.ctx, deviceId: 'xl-2' })).code, 'HOLD_REQUIRED');
  const second = h.command('reset'), p2 = h.model.beginPress(second, h.ctx); h.advance(1600); h.model.cancelPress(p2.pressId, h.ctx);
  assert.equal((await h.model.dispatch({ ...second, pressId: p2.pressId }, h.ctx)).code, 'HOLD_REQUIRED');
  const third = h.command('reset'), p3 = h.model.beginPress(third, h.ctx); h.advance(1600);
  assert.equal((await h.model.dispatch({ ...third, timerId: 't2', pressId: p3.pressId }, h.ctx)).code, 'HOLD_REQUIRED');
  assert.equal(h.operations.filter(op => op.type === 'reset').length, 0);
});

test('wall clock jumps do not bypass monotonic protection; abandoned long presses expire', async () => {
  const h = harness(), command = h.command('blackout'), press = h.model.beginPress(command, h.ctx);
  h.jumpWall(24 * 3600000);
  assert.equal((await h.model.dispatch({ ...command, pressId: press.pressId }, h.ctx)).code, 'HOLD_REQUIRED');
  const late = h.command('blackout'), p2 = h.model.beginPress(late, h.ctx); h.advanceMonotonic(16000);
  assert.equal((await h.model.dispatch({ ...late, pressId: p2.pressId }, h.ctx)).code, 'HOLD_REQUIRED');
});

test('START SET rejects stale preparation or ACTIVE changed during the hold', async () => {
  const h = harness(), command = h.startSet();
  await h.send('preset', 't1', { durationMs: 300000 });
  assert.equal((await h.model.dispatch(command, h.ctx)).code, 'SET_CHANGED');
  await h.send('start'); const another = h.startSet(), press = h.model.beginPress(another, h.ctx); h.advance(1500);
  // A legacy UI/API operation mutates the same authoritative timer.
  h.clocks.t1.endAt += 10000; h.model.observe();
  assert.equal((await h.model.dispatch({ ...another, pressId: press.pressId }, h.ctx)).code, 'ACTIVE_CHANGED');
  assert.equal(h.operations.filter(op => op.type === 'startSet').length, 0);
});

test('START/PAUSE never loads SET; explicit start, pause and resume are idempotent', async () => {
  const h = harness(); await h.send('preset', 't1', { durationMs: 1000 });
  await h.send('startPause'); h.advance(2000); await h.send('pause');
  assert.equal(h.clocks.t1.remMs, 598000); assert.equal(h.clocks.t1.durationMs, 600000);
  await h.send('pause'); await h.send('resume'); await h.send('resume');
  assert.deepEqual(h.operations.map(op => op.type), ['start', 'pause', 'resume']);
  assert.equal(h.model.snapshot().timers.t1.draft.durationMs, 1000);
});

test('RESET restores last-start duration despite LIVE corrections and never clears SET', async () => {
  const h = harness(); await h.send('start'); h.advance(60000);
  await h.send('adjust', 't1', { step: 5, unit: 'm', target: 'live' });
  await h.send('preset', 't1', { durationMs: 900000 });
  assert.equal(h.clocks.t1.durationMs, 900000);
  const command = h.command('reset'), press = h.model.beginPress(command, h.ctx); h.advance(1500);
  assert.equal((await h.model.dispatch({ ...command, pressId: press.pressId }, h.ctx)).ok, true);
  assert.equal(h.clocks.t1.remMs, 600000); assert.equal(h.clocks.t1.durationMs, 600000);
  assert.equal(h.model.snapshot().timers.t1.active.status, 'READY');
  assert.equal(h.model.snapshot().timers.t1.draft.durationMs, 900000);
  await h.send('clearSet'); assert.equal(h.clocks.t1.remMs, 600000); assert.equal(h.model.snapshot().timers.t1.draft.durationMs, 0);
});

test('explicit legacy reload updates reset baseline even when loaded duration equals LIVE-adjusted value', async () => {
  const h = harness(); await h.send('start'); await h.send('adjust', 't1', { step: 5, unit: 'm', target: 'live' });
  assert.equal(h.model.snapshot().timers.t1.active.lastStartDurationMs, 600000);
  // Existing Control or old HTTP setDuration loads 15m, matching the adjusted duration.
  Object.assign(h.clocks.t1, { running: false, durationMs: 900000, remMs: 900000 });
  h.model.prepared('t1');
  assert.equal(h.model.snapshot().timers.t1.active.status, 'READY');
  h.clocks.t1.running = true; h.clocks.t1.endAt = 100000 + 900000; h.model.observe();
  const reset = h.command('reset'), press = h.model.beginPress(reset, h.ctx); h.advance(1500);
  await h.model.dispatch({ ...reset, pressId: press.pressId }, h.ctx);
  assert.equal(h.clocks.t1.remMs, 900000);
  assert.equal(h.model.snapshot().timers.t1.draft.durationMs, 600000);
});

test('presets always prepare countdown SET even when LIVE is explicitly selected', async () => {
  const h = harness(); await h.send('start');
  await h.model.confirmTwice(h.command('editTarget', 't1', { target: 'live' }), h.ctx);
  assert.equal((await h.model.confirmTwice(h.command('editTarget', 't1', { target: 'live' }), h.ctx)).ok, true);
  const raw = structuredClone(h.clocks); await h.send('clock'); await h.send('preset', 't1', { durationMs: 300000 });
  assert.equal(h.model.snapshot().editTarget, 'live');
  assert.equal(h.model.snapshot().timers.t1.draft.mode, 'countdown'); assert.deepEqual(h.clocks, raw);
  await h.send('selectTimer', 't1', { timerId: 't2' }); assert.equal(h.model.snapshot().editTarget, 'set');
  await h.model.confirmTwice(h.command('editTarget', 't2', { target: 'live' }), h.ctx);
  await h.model.confirmTwice(h.command('editTarget', 't2', { target: 'live' }), h.ctx);
  assert.equal(h.model.snapshot().editTarget, 'live'); h.model.disconnect(h.ctx); assert.equal(h.model.snapshot().editTarget, 'set');
});

test('hours/minutes/seconds are configurable and bounded; milliseconds stay explicit', async () => {
  const h = harness(); await h.send('clearSet');
  for (const [step, unit] of [[1, 'h'], [23, 'm'], [45, 's']]) assert.equal((await h.send('adjust', 't1', { step, unit, target: 'set' })).ok, true);
  assert.equal(h.model.snapshot().timers.t1.draft.durationMs, 5025000);
  await h.send('adjust', 't1', { step: -99, unit: 'h', target: 'set' }); assert.equal(h.model.snapshot().timers.t1.draft.durationMs, 0);
  await h.send('preset', 't1', { durationMs: Model.MAX_DURATION });
  await h.send('adjust', 't1', { step: 1, unit: 's', target: 'set' }); assert.equal(h.model.snapshot().timers.t1.draft.durationMs, Model.MAX_DURATION);
  for (const payload of [{ step: 1, unit: 'ms', target: 'set' }, { step: 100, unit: 'h', target: 'set' },
    { step: 0.5, unit: 's', target: 'set' }, { step: 1, unit: 's' }, { step: Infinity, unit: 'm', target: 'set' }]) {
    assert.equal((await h.send('adjust', 't1', payload)).code, 'INVALID_ADJUST');
  }
  assert.equal((await h.send('preset', 't1', { durationMs: 1500 })).code, 'INVALID_DURATION');
  assert.equal((await h.send('preset', 't1', { durationMs: '60000' })).code, 'INVALID_DURATION');
});

test('01:23:45 numeric entry is SET-only, with ACTIVE still available and no keyboard', async () => {
  const h = harness(); await h.send('start'); const raw = structuredClone(h.clocks);
  await h.send('enterTime');
  for (const digit of [0, 1, 2, 3, 4, 5]) await h.send('numericDigit', 't1', { digit });
  assert.equal(h.model.snapshot().numeric.buffer, '012345');
  assert.equal(h.model.snapshot().timers.t1.active.status, 'RUNNING');
  assert.equal(h.model.snapshot().timers.t1.draft.status, 'EDITING');
  assert.equal((await h.send('numericApply')).ok, true);
  assert.equal(h.model.snapshot().timers.t1.draft.durationMs, 5025000); assert.equal(h.model.snapshot().numeric, null);
  assert.deepEqual(h.clocks, raw);
});

test('numeric fields, backspace, clear and cancel validate 99h without 24h rollover', async () => {
  const h = harness(); await h.send('numericBegin');
  for (const digit of [9, 9, 5, 9, 5, 9]) await h.send('numericDigit', 't1', { digit });
  await h.send('numericApply'); assert.equal(h.model.snapshot().timers.t1.draft.durationMs, Model.MAX_DURATION);
  await h.send('numericBegin'); await h.send('numericField', 't1', { field: 'hours' });
  await h.send('numericDigit', 't1', { digit: 2 }); await h.send('numericDigit', 't1', { digit: 5 });
  assert.equal((await h.send('numericDigit', 't1', { digit: 1 })).code, 'FIELD_FULL');
  await h.send('numericField', 't1', { field: 'minutes' });
  await h.send('numericDigit', 't1', { digit: 7 }); await h.send('numericDigit', 't1', { digit: 5 });
  assert.equal((await h.send('numericApply')).code, 'INVALID_TIME');
  await h.send('numericBackspace'); await h.send('numericDigit', 't1', { digit: 0 });
  assert.equal(h.model.snapshot().numeric.buffer, '257000');
  await h.send('numericField', 't1', { field: 'minutes' }); await h.send('numericDigit', 't1', { digit: 3 });
  await h.send('numericApply'); assert.equal(h.model.snapshot().timers.t1.draft.durationMs, (25 * 3600 + 3 * 60) * 1000);
  await h.send('numericBegin'); await h.send('numericClear'); await h.send('numericCancel');
  assert.equal(h.model.snapshot().timers.t1.draft.durationMs, (25 * 3600 + 3 * 60) * 1000);
});

test('numeric entry ownership prevents a second device or timer from applying another buffer', async () => {
  const h = harness(); await h.send('numericBegin');
  assert.equal((await h.send('numericDigit', 't2', { digit: 1 })).code, 'NO_TIME_ENTRY');
  assert.equal((await h.send('numericApply', 't1', undefined, {}, { ...h.ctx, deviceId: 'other' })).code, 'NO_TIME_ENTRY');
  h.model.disconnect(h.ctx); assert.equal(h.model.snapshot().numeric, null);
});

test('both timers have independent draft versions, transport and preparation modes', async () => {
  const h = harness(); await h.send('preset', 't1', { durationMs: 300000 }); await h.send('preset', 't2', { durationMs: 900000 });
  await h.model.dispatch(h.startSet('t1'), h.ctx); await h.model.dispatch(h.startSet('t2'), h.ctx);
  h.advance(7000); await h.send('pause', 't2'); h.advance(3000);
  const state = h.model.snapshot(); assert.equal(state.timers.t1.active.remainingMs, 290000); assert.equal(state.timers.t2.active.remainingMs, 893000);
  await h.send('countup', 't2'); assert.equal(h.model.snapshot().timers.t2.draft.mode, 'countup'); assert.equal(h.clocks.t2.mode, 'countdown');
  assert.equal(h.model.snapshot().timers.t1.draft.mode, 'countdown');
});

test('timerId and adjustment target are mandatory and pinned before async processing', async () => {
  const h = harness(); assert.equal((await h.model.dispatch({ commandId: 'missing', type: 'reset', timerId: 'selected' })).code, 'INVALID_COMMAND');
  const command = h.command('adjust', 't1', { step: 1, unit: 'm', target: 'set' });
  const pending = h.model.dispatch(command, h.ctx); command.timerId = 't2'; command.payload.target = 'live';
  await h.send('selectTimer', 't1', { timerId: 't2' }); await pending;
  assert.equal(h.model.snapshot().timers.t1.draft.durationMs, 660000); assert.equal(h.model.snapshot().timers.t2.draft.durationMs, 600000);
  assert.equal(h.operations.length, 0);
});

test('connection loss cancels pending guards and queued commands, with no replay on reconnect', async () => {
  let release;
  const blocker = new Promise(resolve => { release = resolve; });
  const h = harness({ applyOperation: async () => { await blocker; return { ok: true }; } });
  const first = h.send('bell');
  await Promise.resolve(); await Promise.resolve();
  const pending = h.send('start');
  const reset = h.command('reset'), press = h.model.beginPress(reset, h.ctx); h.advance(1500);
  h.model.disconnect(h.ctx); release(); await first;
  assert.equal((await pending).code, 'OFFLINE');
  h.model.connect(h.ctx);
  assert.equal((await h.model.dispatch({ ...reset, pressId: press.pressId }, h.ctx)).code, 'HOLD_REQUIRED');
  assert.equal((await h.send('start', 't1', undefined, {}, { ...h.ctx, connected: false })).code, 'OFFLINE');
});

test('two-press confirmation protects hotkeys without pretending to receive keyUp', async () => {
  const h = harness(), first = h.command('blackout');
  assert.equal((await h.model.confirmTwice(first, h.ctx)).code, 'CONFIRM_REQUIRED');
  h.advance(1000);
  assert.equal((await h.model.confirmTwice(h.command('blackout'), h.ctx)).ok, true);
  assert.equal(h.operations.length, 1);
  assert.equal((await h.model.confirmTwice(h.command('reset'), h.ctx)).code, 'CONFIRM_REQUIRED');
  h.advance(5001);
  assert.equal((await h.model.confirmTwice(h.command('reset'), h.ctx)).code, 'CONFIRM_REQUIRED');
  assert.equal(h.operations.length, 1);
});

test('command ordering rejects late sequence numbers; different controllers do not collide', async () => {
  const h = harness();
  assert.equal((await h.send('preset', 't1', { durationMs: 10000 }, { sequence: 3 })).ok, true);
  assert.equal((await h.send('preset', 't1', { durationMs: 20000 }, { sequence: 2 })).code, 'OUT_OF_ORDER');
  assert.equal((await h.send('preset', 't2', { durationMs: 20000 }, { sequence: 1 }, { ...h.ctx, deviceId: 'xl-2' })).ok, true);
  assert.equal(h.model.snapshot().timers.t1.draft.durationMs, 10000);
});

test('adapter success is applied not merely received; errors cannot masquerade as success', async () => {
  for (const applyOperation of [() => undefined, () => ({ ok: false, code: 'UNAVAILABLE' }), () => { throw new Error('private token'); }]) {
    const h = harness({ applyOperation }); const result = await h.send('bell');
    assert.equal(result.ok, false); assert.ok(!JSON.stringify(result).includes('private token'));
  }
});

test('commands waiting behind asynchronous native operations expire before mutation', async () => {
  let release; const blocker = new Promise(resolve => { release = resolve; }); const calls = [];
  const h = harness({ applyOperation: async operation => { calls.push(operation.type); if (operation.type === 'bell') await blocker; return { ok: true }; } });
  const first = h.send('bell'); await Promise.resolve(); await Promise.resolve();
  const queued = h.send('start', 't1', undefined, {}, { ...h.ctx, guardDeadline: 3500 });
  h.advanceMonotonic(3501); release(); await first;
  assert.equal((await queued).code, 'COMMAND_EXPIRED'); assert.deepEqual(calls, ['bell']);
});

test('LOAD SELECTED stages SET only; PREV/NEXT are selection, not legacy GO', async () => {
  const h = harness(); await h.send('start'); const raw = structuredClone(h.clocks);
  for (const type of ['prev', 'next', 'loadSelected']) assert.equal((await h.send(type, 't2')).ok, true);
  assert.deepEqual(h.clocks, raw); assert.equal(h.model.snapshot().timers.t2.draft.durationMs, 75000);
  assert.deepEqual(h.operations.slice(1).map(op => op.type), ['prev', 'next', 'loadSelected']);
});

test('saved drafts survive restart but LIVE, numeric input and selected timer reset safely', async () => {
  const h = harness(); await h.send('preset', 't2', { durationMs: 5025000 }); await h.send('clock', 't1');
  await h.send('selectTimer', 't1', { timerId: 't2' });
  await h.model.confirmTwice(h.command('editTarget', 't2', { target: 'live' }), h.ctx);
  await h.model.confirmTwice(h.command('editTarget', 't2', { target: 'live' }), h.ctx);
  await h.send('numericBegin', 't2');
  const state = h.model.persisted(), fresh = harness({ persisted: state }).model.snapshot();
  assert.equal(fresh.timers.t1.draft.mode, 'clock'); assert.equal(fresh.timers.t2.draft.durationMs, 5025000);
  assert.equal(fresh.selectedTimerId, 't1'); assert.equal(fresh.editTarget, 'set'); assert.equal(fresh.numeric, null);
  assert.deepEqual(Object.keys(state).sort(), ['drafts', 'schemaVersion']);
});

test('LIVE activation requires a guarded intentional action; SET always returns immediately', async () => {
  const h = harness(); assert.equal((await h.send('editTarget', 't1', { target: 'live' })).code, 'HOLD_REQUIRED');
  const command = h.command('editTarget', 't1', { target: 'live' }), press = h.model.beginPress(command, h.ctx);
  h.advance(1500); assert.equal((await h.model.dispatch({ ...command, pressId: press.pressId }, h.ctx)).ok, true);
  assert.equal(h.model.snapshot().editTarget, 'live'); assert.equal((await h.send('editTarget', 't1', { target: 'set' })).ok, true);
  assert.equal(h.model.snapshot().editTarget, 'set');
});

test('session-level disconnect invalidates every physical device guard and queued command', async () => {
  let release; const block = new Promise(resolve => { release = resolve; });
  const h = harness({ applyOperation: async () => { await block; return { ok: true }; } });
  const ctx2 = { ...h.ctx, deviceId: 'xl-2' }, first = h.send('bell'); await Promise.resolve();
  const pending1 = h.send('start'), pending2 = h.send('start', 't2', undefined, {}, ctx2);
  const command = h.command('reset', 't2'), press = h.model.beginPress(command, ctx2); h.advance(1500);
  h.model.disconnect({ sourceId: h.ctx.sourceId, sessionId: h.ctx.sessionId }); release(); await first;
  assert.equal((await pending1).code, 'OFFLINE'); assert.equal((await pending2).code, 'OFFLINE');
  assert.equal((await h.model.dispatch({ ...command, pressId: press.pressId }, ctx2)).code, 'HOLD_REQUIRED');
});

test('CLOCK display is sampled from the authoritative host clock, not a plugin clock', async () => {
  const h = harness(); await h.send('clock'); await h.model.dispatch(h.startSet(), h.ctx);
  const before = h.model.snapshot().timers.t1.active;
  assert.match(before.display, /^\d{2}:\d{2}:\d{2}$/); h.advance(1000);
  assert.equal(h.model.snapshot().timers.t1.active.clockMs - before.clockMs, 1000);
});

test('long simulated intervals sample host truth, preserve >24h and expose overtime', async () => {
  const h = harness(); await h.send('preset', 't1', { durationMs: Model.MAX_DURATION }); await h.model.dispatch(h.startSet(), h.ctx);
  const version = h.model.snapshot().timers.t1.active.version;
  for (let hour = 0; hour < 99; hour++) { h.advance(3600000); assert.equal(h.model.snapshot().timers.t1.active.version, version); }
  assert.equal(Model.formatTime(h.model.snapshot().timers.t1.active.remainingMs), '59:59');
  h.advance(3600000); assert.equal(h.model.snapshot().timers.t1.active.status, 'OVERTIME');
  assert.equal(h.model.snapshot().timers.t1.active.remainingMs, -1000);
  assert.equal(Model.formatTime(Model.MAX_DURATION), '99:59:59'); assert.equal(Model.formatTime(-1500), '−0:01');
  assert.equal(Model.parseHMS('25:00:00'), 90000000); assert.equal(Model.parseHMS('01:60:00'), null);
  // A wall clock jump is deliberately reflected from the existing host engine, not hidden by a plugin countdown.
  h.jumpWall(-300000); assert.equal(h.model.snapshot().timers.t1.active.remainingMs, 299000);
});

test('read-only state observation does not open an output, ring or change profiles', () => {
  const h = harness();
  for (let i = 0; i < 1000; i++) { h.advance(100); h.model.snapshot(); h.model.observe(); }
  h.model.connect(h.ctx); h.model.disconnect(h.ctx);
  assert.equal(h.operations.length, 0);
});

test('untrusted commands cannot carry code, unknown actions, secrets, or unknown payloads', async () => {
  const h = harness();
  assert.equal((await h.model.dispatch({ commandId: 'test', type: 'eval', timerId: 't1' })).code, 'INVALID_COMMAND');
  assert.equal((await h.model.dispatch({ ...h.command('bell'), token: 'secret' })).code, 'INVALID_COMMAND');
  assert.equal((await h.send('bell', 't1', { shell: 'anything' })).code, 'INVALID_PAYLOAD');
  assert.equal((await h.send('message', 't1', { text: 'x'.repeat(501) })).code, 'INVALID_MESSAGE');
  assert.equal((await h.send('startSet', 't1', undefined, { expectedActiveVersion: Infinity })).code, 'INVALID_COMMAND');
  assert.equal(h.operations.length, 0);
});
