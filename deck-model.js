// Authoritative command coordinator, not a timer engine. The existing host owns all clocks.
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else { root.DeckModel = value; root.ProTimerDeckModel = value; }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SCHEMA_VERSION = 1, MAX_DURATION = 359999000, HOLD_MS = 1500, CONFIRM_MS = 5000;
  const TIMER_IDS = ['t1', 't2'], MODES = ['countdown', 'countup', 'clock'];
  const TYPES = new Set(['startPause', 'startSet', 'start', 'pause', 'resume', 'reset', 'adjust', 'preset', 'clearSet',
    'editTarget', 'selectTimer', 'countdown', 'countup', 'clock', 'bell', 'blackout', 'outputA', 'outputB',
    'message', 'settings', 'back', 'prev', 'next', 'loadSelected', 'fullscreen', 'enterTime',
    'numericBegin', 'numericDigit', 'numericField', 'numericBackspace', 'numericClear', 'numericApply', 'numericCancel']);
  const clone = value => JSON.parse(JSON.stringify(value));
  const plain = value => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const boundedMs = value => Number.isInteger(value) && value >= 0 && value <= MAX_DURATION;
  const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(value);
  function formatTime(ms) {
    if (!Number.isFinite(ms)) return '--:--';
    const sec = ms < 0 ? Math.floor(-ms / 1000) : Math.ceil(ms / 1000), hours = Math.floor(sec / 3600);
    return `${ms < 0 ? '−' : ''}${hours ? `${hours}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}` : Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }
  function parseHMS(input) {
    if (typeof input !== 'string' || !/^\d{1,2}:\d{2}:\d{2}$/.test(input)) return null;
    const [h, m, s] = input.split(':').map(Number);
    return h <= 99 && m <= 59 && s <= 59 ? (h * 3600 + m * 60 + s) * 1000 : null;
  }
  function create(options) {
    if (!options || typeof options.readActive !== 'function' || typeof options.applyOperation !== 'function') throw new Error('An authoritative timer adapter is required');
    const wallNow = options.now || Date.now;
    const guardNow = options.guardNow || (() => performance.now());
    const timers = {}, guards = new Map(), confirmations = new Map(), results = new Map(), sequences = new Map(), epochs = new Map();
    let selectedTimerId = 't1', editTarget = 'set', numeric = null, nextPress = 0, queue = Promise.resolve(), observing = false;
    const saved = options.persisted?.schemaVersion === SCHEMA_VERSION ? options.persisted : null;
    for (const id of TIMER_IDS) {
      const candidate = saved?.drafts?.[id], raw = options.readActive(id) || {};
      timers[id] = { version: 1, fingerprint: null, raw, lastStartDurationMs: boundedMs(raw.durationMs) ? raw.durationMs : 0,
        hasStarted: !!raw.running, draft: { mode: MODES.includes(candidate?.mode) ? candidate.mode : 'countdown',
          durationMs: boundedMs(candidate?.durationMs) ? candidate.durationMs : boundedMs(raw.durationMs) ? raw.durationMs : 600000,
          version: 1 } };
    }
    function contextKey(context = {}) { return `${context.sourceId || 'control'}|${context.sessionId || 'local'}|${context.deviceId || ''}`; }
    function notify() { if (typeof options.onChange === 'function') options.onChange(snapshot(), persisted()); }
    function activeFingerprint(raw) {
      return JSON.stringify([raw.mode || 'countdown', !!raw.running, raw.durationMs, raw.remMs, raw.endAt,
        raw.elapsedMs, raw.startAt, raw.enabled !== false, raw.overtime !== false, raw.revision]);
    }
    function observe() {
      if (observing) return false;
      observing = true; let changed = false;
      try {
        for (const id of TIMER_IDS) {
          const timer = timers[id], raw = options.readActive(id) || {}, fingerprint = activeFingerprint(raw);
          if (timer.fingerprint !== null && fingerprint !== timer.fingerprint) { timer.version++; changed = true; }
          if (!!raw.running && !timer.raw.running) {
            if (!timer.hasStarted && boundedMs(raw.durationMs)) timer.lastStartDurationMs = raw.durationMs;
            timer.hasStarted = true;
          }
          if (!raw.running && (raw.mode || 'countdown') === 'countdown' && raw.remMs === raw.durationMs &&
              timer.raw.durationMs !== raw.durationMs) timer.hasStarted = false;
          timer.raw = { ...raw }; timer.fingerprint = fingerprint;
        }
      } finally { observing = false; }
      return changed;
    }
    function activeView(id) {
      const timer = timers[id], raw = timer.raw, now = wallNow(), mode = MODES.includes(raw.mode) ? raw.mode : 'countdown';
      let remainingMs = Number.isFinite(raw.remainingMs) ? raw.remainingMs : raw.running ? raw.endAt - now : raw.remMs;
      let elapsedMs = Number.isFinite(raw.currentElapsedMs) ? raw.currentElapsedMs : (raw.elapsedMs || 0) + (raw.running && mode === 'countup' ? now - raw.startAt : 0);
      if (raw.overtime === false) remainingMs = Math.max(0, remainingMs);
      if (!Number.isFinite(remainingMs)) remainingMs = 0;
      if (!Number.isFinite(elapsedMs)) elapsedMs = 0;
      const paused = raw.paused !== undefined ? raw.paused : timer.hasStarted || (mode === 'countup' ? elapsedMs > 0 : remainingMs !== raw.durationMs);
      const status = mode === 'countdown' && remainingMs < 0 ? 'OVERTIME' : raw.running || mode === 'clock' ? 'RUNNING' : paused ? 'PAUSED' : 'READY';
      const clock = new Date(now), clockMs = (clock.getHours() * 3600 + clock.getMinutes() * 60 + clock.getSeconds()) * 1000;
      return { mode, running: !!raw.running, durationMs: raw.durationMs || 0, remainingMs, elapsedMs, clockMs,
        display: mode === 'clock' ? `${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}:${String(clock.getSeconds()).padStart(2, '0')}` : formatTime(mode === 'countup' ? elapsedMs : remainingMs),
        status, version: timer.version, enabled: raw.enabled !== false, overtime: raw.overtime !== false,
        lastStartDurationMs: timer.lastStartDurationMs };
    }
    function snapshot() {
      observe(); const state = { schemaVersion: SCHEMA_VERSION, selectedTimerId, editTarget, timers: {}, numeric: null };
      for (const id of TIMER_IDS) state.timers[id] = { active: activeView(id), draft: { ...timers[id].draft, status: numeric?.timerId === id ? 'EDITING' : 'READY' } };
      if (numeric) state.numeric = { timerId: numeric.timerId, buffer: numeric.buffer, field: numeric.field };
      return state;
    }
    function persisted() { return { schemaVersion: SCHEMA_VERSION, drafts: Object.fromEntries(TIMER_IDS.map(id => [id, { mode: timers[id].draft.mode, durationMs: timers[id].draft.durationMs }])) }; }
    function prepared(timerId) {
      // A legacy UI/API duration load is explicit information that cannot be
      // inferred reliably from clocks (an immediate pause can look identical).
      if (!TIMER_IDS.includes(timerId)) return fail('INVALID_TARGET', 'Choose Timer 1 or Timer 2');
      observe(); const timer = timers[timerId];
      timer.hasStarted = false;
      timer.lastStartDurationMs = boundedMs(timer.raw.durationMs) ? timer.raw.durationMs : 0;
      timer.version++;
      notify(); return { ok: true };
    }
    function fail(code, message, extra = {}) { return { ok: false, code, message, ...extra }; }
    function validateCommand(command) {
      if (!plain(command)) return fail('INVALID_COMMAND', 'Command must be an object');
      for (const field of Object.keys(command)) if (!['commandId', 'type', 'timerId', 'payload', 'expectedActiveVersion', 'expectedDraftVersion', 'sequence', 'pressId'].includes(field)) return fail('INVALID_COMMAND', `Unsupported command field: ${field}`);
      if (!safeId(command.commandId) || !TYPES.has(command.type) || !TIMER_IDS.includes(command.timerId)) return fail('INVALID_COMMAND', 'A known command, commandId and concrete timerId are required');
      if (command.payload !== undefined && !plain(command.payload)) return fail('INVALID_COMMAND', 'Payload must be an object');
      if (command.sequence !== undefined && (!Number.isSafeInteger(command.sequence) || command.sequence < 0)) return fail('INVALID_COMMAND', 'Invalid command sequence');
      for (const field of ['expectedActiveVersion', 'expectedDraftVersion']) if (command[field] !== undefined && (!Number.isSafeInteger(command[field]) || command[field] < 1)) return fail('INVALID_COMMAND', 'Invalid expected version');
      if (command.pressId !== undefined && !safeId(command.pressId)) return fail('INVALID_COMMAND', 'Invalid press identity');
      return null;
    }
    function commandSignature(command) {
      return JSON.stringify([command.type, command.timerId, command.payload || {}, command.expectedActiveVersion, command.expectedDraftVersion]);
    }
    function protectedCommand(command) {
      if (['reset', 'blackout'].includes(command.type)) return true;
      if (command.type === 'editTarget') return command.payload?.target === 'live' || (!command.payload?.target && editTarget === 'set');
      if (command.type === 'startSet') return ['RUNNING', 'PAUSED', 'OVERTIME'].includes(activeView(command.timerId).status);
      return false;
    }
    function checkVersions(command) {
      observe(); const timer = timers[command.timerId];
      if (command.type === 'startSet' && (command.expectedActiveVersion === undefined || command.expectedDraftVersion === undefined)) return fail('VERSION_REQUIRED', 'START SET requires the displayed ACTIVE and SET versions');
      if (command.expectedActiveVersion !== undefined && command.expectedActiveVersion !== timer.version) return fail('ACTIVE_CHANGED', 'ACTIVE changed; review its current state and press again');
      if (command.expectedDraftVersion !== undefined && command.expectedDraftVersion !== timer.draft.version) return fail('SET_CHANGED', 'SET changed; review the prepared time and press again');
      return null;
    }
    function beginPress(command, context = {}) {
      const invalid = validateCommand(command) || checkVersions(command); if (invalid) return invalid;
      if (context.connected === false) return fail('OFFLINE', 'The controller is disconnected');
      const source = contextKey(context), pressId = `press-${++nextPress}-${Math.floor(guardNow()).toString(36)}`;
      for (const [id, guard] of guards) if (guard.source === source && guard.commandId === command.commandId) guards.delete(id);
      guards.set(pressId, { source, commandId: command.commandId, signature: commandSignature(command), startedAt: guardNow(), epoch: epochs.get(source) || 0 });
      return { ok: true, pressId, holdMs: protectedCommand(command) ? HOLD_MS : 0 };
    }
    function cancelPress(pressId, context = {}) { const guard = guards.get(pressId); if (guard?.source === contextKey(context)) guards.delete(pressId); return { ok: true }; }
    function disconnect(context = {}) {
      const source = contextKey(context), prefix = source.slice(0, source.lastIndexOf('|') + 1);
      // The transport can disconnect an entire plugin session without enumerating USB devices.
      const affected = key => context.deviceId === undefined ? key.startsWith(prefix) : key === source;
      const sources = new Set([source, ...epochs.keys(), ...sequences.keys(), ...confirmations.keys(), ...Array.from(guards.values(), g => g.source)]);
      for (const key of sources) if (affected(key)) { epochs.set(key, (epochs.get(key) || 0) + 1); confirmations.delete(key); sequences.delete(key); }
      for (const [id, guard] of guards) if (affected(guard.source)) guards.delete(id);
      if (numeric && affected(numeric.owner)) numeric = null;
      editTarget = 'set'; notify();
    }
    function connect(context = {}) { disconnect(context); return snapshot(); }
    function confirmTwice(command, context = {}) {
      const invalid = validateCommand(command) || checkVersions(command); if (invalid) return Promise.resolve(invalid);
      const source = contextKey(context), signature = commandSignature(command), pending = confirmations.get(source), now = guardNow();
      if (!protectedCommand(command)) return dispatch(command, context);
      if (!pending || pending.signature !== signature || now > pending.expiresAt) {
        confirmations.set(source, { signature, expiresAt: now + CONFIRM_MS });
        return Promise.resolve(fail('CONFIRM_REQUIRED', 'Press again within 5 seconds to confirm this protected command', { expiresInMs: CONFIRM_MS }));
      }
      confirmations.delete(source);
      const result = beginPress(command, context); if (!result.ok) return Promise.resolve(result);
      guards.get(result.pressId).confirmed = true;
      return dispatch({ ...command, pressId: result.pressId }, context);
    }
    function enforceGuard(command, context) {
      const guard = guards.get(command.pressId), source = contextKey(context);
      if (command.pressId) guards.delete(command.pressId); // A physical press can apply at most once.
      if (!protectedCommand(command) && !command.pressId) return null;
      if (!guard || guard.source !== source || guard.commandId !== command.commandId || guard.signature !== commandSignature(command) ||
          guard.epoch !== (epochs.get(source) || 0)) return fail('HOLD_REQUIRED', 'Hold for 1.5 seconds, or explicitly confirm this action');
      if (!guard.confirmed && (guardNow() - guard.startedAt < HOLD_MS || guardNow() - guard.startedAt > 15000)) return fail('HOLD_REQUIRED', 'Hold for 1.5 seconds');
      return null;
    }
    function updateDraft(id, update) {
      const draft = timers[id].draft;
      if (update.durationMs !== undefined) draft.durationMs = update.durationMs;
      if (update.mode !== undefined) draft.mode = update.mode;
      draft.version++; notify();
    }
    function validatePayload(type, payload) {
      const fields = {
        adjust: ['step', 'unit', 'target'], preset: ['durationMs'], editTarget: ['target'], selectTimer: ['timerId'],
        numericDigit: ['digit'], numericField: ['field'], message: ['text', 'flash'], fullscreen: ['output'],
        outputA: ['action'], outputB: ['action']
      }[type] || [];
      for (const key of Object.keys(payload)) if (!fields.includes(key)) return fail('INVALID_PAYLOAD', `Unsupported ${type} payload field: ${key}`);
      return null;
    }
    async function execute(command, context) {
      let invalid = validateCommand(command); if (invalid) return invalid;
      if (context.connected === false) return fail('OFFLINE', 'The controller is disconnected');
      const payload = command.payload || {}, id = command.timerId, timer = timers[id];
      invalid = validatePayload(command.type, payload) || checkVersions(command); if (invalid) return invalid;
      invalid = enforceGuard(command, context); if (invalid) return invalid;
      const state = activeView(id), type = command.type;
      if (['preset', 'clearSet', 'countdown', 'countup', 'clock'].includes(type)) {
        if (type === 'preset') { if (!boundedMs(payload.durationMs) || payload.durationMs % 1000) return fail('INVALID_DURATION', 'SET must be a whole-second duration from 00:00:00 to 99:59:59'); updateDraft(id, { mode: 'countdown', durationMs: payload.durationMs }); }
        else if (type === 'clearSet') updateDraft(id, { durationMs: 0 });
        else updateDraft(id, { mode: type });
        return { ok: true };
      }
      if (type === 'selectTimer') {
        const target = payload.timerId || (selectedTimerId === 't1' ? 't2' : 't1');
        if (!TIMER_IDS.includes(target)) return fail('INVALID_TARGET', 'Choose Timer 1 or Timer 2');
        selectedTimerId = target; editTarget = 'set'; numeric = null; guards.clear(); confirmations.clear(); notify(); return { ok: true };
      }
      if (type === 'editTarget') {
        if (payload.target !== undefined && !['set', 'live'].includes(payload.target)) return fail('INVALID_TARGET', 'Choose SET or LIVE explicitly');
        editTarget = payload.target || (editTarget === 'set' ? 'live' : 'set'); notify(); return { ok: true };
      }
      if (type === 'enterTime' || type.startsWith('numeric')) return numericCommand(command, context);
      if (type === 'adjust') {
        const multiplier = { h: 3600000, m: 60000, s: 1000 }[payload.unit];
        if (!Number.isInteger(payload.step) || payload.step === 0 || !multiplier || !['set', 'live'].includes(payload.target) ||
            !Number.isSafeInteger(payload.step * multiplier) || Math.abs(payload.step * multiplier) > MAX_DURATION) return fail('INVALID_ADJUST', 'Choose a bounded signed step, h/m/s unit and concrete SET/LIVE target');
        const deltaMs = payload.step * multiplier;
        if (payload.target === 'set') { updateDraft(id, { durationMs: Math.max(0, Math.min(MAX_DURATION, timer.draft.durationMs + deltaMs)) }); return { ok: true }; }
        if (state.mode !== 'countdown') return fail('MODE_NOT_ADJUSTABLE', 'LIVE adjustments require countdown mode');
        if (!state.enabled) return fail('TIMER_DISABLED', 'Enable Timer 2 before controlling its ACTIVE timer');
        return apply({ type: 'adjust', timerId: id, deltaMs, commandId: command.commandId });
      }
      if (['prev', 'next', 'loadSelected'].includes(type)) {
        // The host selects the cue but never calls the legacy GO/load-and-run path.
        const result = await apply({ type, timerId: id, commandId: command.commandId });
        if (!result.ok) return result;
        if (type === 'loadSelected') {
          const cue = result.cue || (typeof options.readRundown === 'function' ? options.readRundown()?.selected : null);
          if (!boundedMs(cue?.durationMs) || cue.durationMs % 1000) return fail('NO_CUE', 'Select a valid rundown item first');
          updateDraft(id, { mode: 'countdown', durationMs: cue.durationMs });
        }
        return result;
      }
      let operation = { type, timerId: id, commandId: command.commandId };
      if (['startSet', 'startPause', 'start', 'pause', 'resume', 'reset'].includes(type)) {
        if (!state.enabled) return fail('TIMER_DISABLED', 'Enable Timer 2 before controlling its ACTIVE timer');
        if (type === 'startSet') {
          if (timer.draft.mode === 'countdown' && timer.draft.durationMs === 0) return fail('EMPTY_SET', 'Prepare a duration greater than zero before START SET');
          operation = { ...operation, mode: timer.draft.mode, durationMs: timer.draft.durationMs };
        } else if (type === 'reset') operation.durationMs = timer.lastStartDurationMs || state.durationMs;
        else {
          operation.type = type === 'startPause' ? state.running ? 'pause' : state.status === 'PAUSED' || state.status === 'OVERTIME' ? 'resume' : 'start' : type;
          if (state.mode === 'clock') return fail('CLOCK_MODE', 'Clock mode follows the computer clock; choose a SET mode and START SET to change it');
          if (['start', 'resume'].includes(operation.type) && state.mode === 'countdown' &&
              (state.durationMs <= 0 || (state.remainingMs <= 0 && state.status === 'READY'))) return fail('NO_ACTIVE_DURATION', 'No valid ACTIVE duration. Prepare SET and use START SET');
          if ((operation.type === 'pause' && !state.running) || (['start', 'resume'].includes(operation.type) && state.running)) return { ok: true, unchanged: true };
          if (operation.type === 'resume' && state.status === 'READY') return fail('NOT_PAUSED', 'The ACTIVE timer is ready; use START');
        }
      }
      if (type === 'message') {
        if (payload.text !== undefined && (typeof payload.text !== 'string' || payload.text.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(payload.text)) || (payload.flash !== undefined && typeof payload.flash !== 'boolean')) return fail('INVALID_MESSAGE', 'Message must be at most 500 characters');
        // A default MESSAGE key focuses the existing Control message editor.
        if (payload.text !== undefined) { operation.text = payload.text; operation.flash = !!payload.flash; }
      }
      if (type === 'fullscreen') { if (payload.output !== undefined && !['a', 'b'].includes(payload.output)) return fail('INVALID_OUTPUT', 'Choose output A or B'); operation.output = payload.output || (id === 't2' ? 'b' : 'a'); }
      if (['outputA', 'outputB'].includes(type)) { if (payload.action !== undefined && !['open', 'close', 'toggle'].includes(payload.action)) return fail('INVALID_OUTPUT', 'Choose open, close or toggle'); operation.action = payload.action || 'toggle'; }
      const beforeVersion = timer.version, result = await apply(operation);
      if (!result.ok) return result;
      if (type === 'startSet' || operation.type === 'start') { timer.lastStartDurationMs = type === 'startSet' ? operation.durationMs : state.durationMs; timer.hasStarted = true; }
      if (type === 'reset') timer.hasStarted = false;
      observe();
      if (['startSet', 'start', 'pause', 'resume', 'reset'].includes(operation.type) && timer.version === beforeVersion) timer.version++;
      notify(); return result;
    }
    async function apply(operation) {
      try {
        const result = await options.applyOperation(operation);
        if (!result || result.ok !== true) return fail(result?.code || 'ADAPTER_REJECTED', result?.message || 'The application did not confirm that the command was applied');
        return result;
      } catch (_) { return fail('ADAPTER_FAILED', 'The application could not apply the command'); }
    }
    function numericCommand(command, context) {
      const source = contextKey(context), payload = command.payload || {}, type = command.type;
      if (type === 'numericBegin' || type === 'enterTime') {
        numeric = { owner: source, timerId: command.timerId, buffer: '000000', field: 'all', fresh: true, digits: '' };
        notify(); return { ok: true };
      }
      if (!numeric || numeric.owner !== source || numeric.timerId !== command.timerId) return fail('NO_TIME_ENTRY', 'Open ENTER TIME for this timer first');
      if (type === 'numericCancel') { numeric = null; notify(); return { ok: true }; }
      if (type === 'numericField') {
        if (!['all', 'hours', 'minutes', 'seconds'].includes(payload.field)) return fail('INVALID_FIELD', 'Choose hours, minutes or seconds');
        numeric.field = payload.field; numeric.fresh = true; numeric.digits = ''; notify(); return { ok: true };
      }
      if (type === 'numericClear') { numeric.buffer = '000000'; numeric.fresh = true; numeric.digits = ''; notify(); return { ok: true }; }
      const length = numeric.field === 'all' ? 6 : 2, offset = { all: 0, hours: 0, minutes: 2, seconds: 4 }[numeric.field];
      if (type === 'numericDigit') {
        if (!Number.isInteger(payload.digit) || payload.digit < 0 || payload.digit > 9) return fail('INVALID_DIGIT', 'Enter one digit from 0 to 9');
        if (numeric.fresh) { numeric.digits = ''; numeric.fresh = false; }
        if (numeric.digits.length >= length) return fail('FIELD_FULL', 'Choose a field or use backspace');
        numeric.digits += payload.digit;
      } else if (type === 'numericBackspace') {
        if (numeric.fresh) numeric.digits = numeric.buffer.slice(offset, offset + length);
        numeric.fresh = false; numeric.digits = numeric.digits.slice(0, -1);
      } else if (type === 'numericApply') {
        const value = parseHMS(`${numeric.buffer.slice(0, 2)}:${numeric.buffer.slice(2, 4)}:${numeric.buffer.slice(4, 6)}`);
        if (value === null) return fail('INVALID_TIME', 'Hours: 00–99. Minutes and seconds: 00–59');
        numeric = null; updateDraft(command.timerId, { mode: 'countdown', durationMs: value }); return { ok: true };
      } else return fail('INVALID_COMMAND', 'Unknown numeric input command');
      numeric.buffer = numeric.buffer.slice(0, offset) + numeric.digits.padStart(length, '0') + numeric.buffer.slice(offset + length);
      notify(); return { ok: true };
    }
    function dispatch(command, context = {}) {
      const invalid = validateCommand(command); if (invalid) return Promise.resolve(invalid);
      const source = contextKey(context), epoch = epochs.get(source) || 0, identity = `${source}|${command.commandId}`;
      if (!epochs.has(source)) epochs.set(source, epoch);
      const signature = commandSignature(command), previous = results.get(identity);
      if (previous) return previous.signature === signature ? previous.promise : Promise.resolve(fail('COMMAND_ID_REUSED', 'A commandId cannot identify different commands'));
      // Copy the target and payload now. Later selection changes cannot retarget a queued command.
      const pinned = clone(command), pinnedContext = { ...context };
      const operation = queue.then(async () => {
        if ((epochs.get(source) || 0) !== epoch || pinnedContext.connected === false) return fail('OFFLINE', 'Connection changed; press again after reconnecting');
        if (pinnedContext.guardDeadline !== undefined && (!Number.isFinite(pinnedContext.guardDeadline) || guardNow() > pinnedContext.guardDeadline)) return fail('COMMAND_EXPIRED', 'Command expired before execution; press again to use the current state');
        if (pinned.sequence !== undefined) {
          if (pinned.sequence <= (sequences.get(source) ?? -1)) return fail('OUT_OF_ORDER', 'Stale command sequence');
          sequences.set(source, pinned.sequence);
        }
        const result = await execute(pinned, pinnedContext);
        return { ...result, commandId: pinned.commandId, state: snapshot() };
      }).catch(() => fail('COMMAND_FAILED', 'The command could not be safely applied'));
      queue = operation.then(() => undefined);
      results.set(identity, { signature, promise: operation });
      if (results.size > 512) results.delete(results.keys().next().value);
      return operation;
    }
    observe();
    return { snapshot, persisted, persistDrafts: persisted, observe, stateChanged: observe, prepared, dispatch, beginPress, cancelPress,
      disconnect, connect, confirmTwice, validateCommand };
  }
  return { SCHEMA_VERSION, MAX_DURATION, HOLD_MS, CONFIRM_MS, TIMER_IDS, MODES, formatTime, parseHMS, create };
});
