// Data-only layout schema. This module never executes commands or owns physical keys.
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else { root.DeckLayout = value; root.ProTimerDeckLayout = value; }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SCHEMA_VERSION = 1, MAX_DURATION = 359999000;
  const definitions = [
    ['startPause', 'START / PAUSE'], ['startSet', 'START SET', 'protected'],
    ['activeTime', 'ACTIVE TIME', 'display'], ['setTime', 'SET TIME', 'display'],
    ['editTarget', 'EDIT SET / LIVE'], ['reset', 'RESET', 'protected'], ['bell', 'BELL'],
    ['adjust', 'ADJUST'], ['preset', 'PRESET'], ['enterTime', 'ENTER TIME'],
    ['countdown', 'COUNTDOWN'], ['countup', 'COUNT UP'], ['clock', 'CLOCK'],
    ['blackout', 'BLACK', 'protected'], ['outputA', 'OUT A'], ['outputB', 'OUT B'],
    ['selectTimer', 'TIMER 1 / 2'], ['message', 'MESSAGE'], ['settings', 'SETTINGS'],
    ['back', 'BACK'], ['prev', 'PREV'], ['next', 'NEXT'], ['loadSelected', 'LOAD SELECTED'],
    ['fullscreen', 'FULLSCREEN'], ['start', 'START'], ['pause', 'PAUSE'], ['resume', 'RESUME'],
    ['clearSet', 'CLEAR SET'], ['empty', 'INACTIVE SLOT', 'display']
  ];
  const catalog = Object.freeze(definitions.map(([id, label, kind]) => Object.freeze({ id, label,
    kind: kind || 'command', protected: kind === 'protected', executable: kind !== 'display' })));
  const commandIds = new Set(catalog.map(c => c.id));
  const icons = Object.freeze(['none', 'play', 'pause', 'stop', 'reset', 'bell', 'plus', 'minus', 'clock', 'timer',
    'screen', 'grid', 'message', 'settings', 'back', 'up', 'down', 'left', 'right', 'lock', 'edit']);
  const fields = new Set(['id', 'command', 'timerId', 'target', 'step', 'unit', 'durationMs', 'name', 'color',
    'icon', 'textSize', 'stateDisplay', 'hotkey', 'pressPolicy']);
  const clone = value => JSON.parse(JSON.stringify(value));
  let counter = 0;
  function newId() {
    return typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `key-${Date.now().toString(36)}-${++counter}`;
  }
  function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)); }
  function defaultKey(command = 'empty', overrides = {}) {
    if (!commandIds.has(command)) throw new Error('Unknown ProTimer command');
    return { id: newId(), command, timerId: 'selected', target: 'selected', step: 1, unit: 's', durationMs: 300000,
      name: '', color: ['setTime', 'preset', 'enterTime'].includes(command) ? '#2563eb' : '#202631', icon: 'none',
      textSize: 18, stateDisplay: true, hotkey: '', pressPolicy: ['startSet', 'reset', 'blackout'].includes(command) ? 'hold' : 'short', ...overrides };
  }
  function cleanText(value, max) { return typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value); }
  function normalizeHotkey(value) {
    if (value === '') return '';
    if (!cleanText(value, 64)) throw new Error('Invalid hotkey');
    const parts = value.split('+').map(p => p.trim());
    const aliases = { ctrl: 'Ctrl', control: 'Ctrl', cmd: 'Meta', command: 'Meta', meta: 'Meta', alt: 'Alt', option: 'Alt', shift: 'Shift' };
    const keyAliases = { space: 'Space', enter: 'Enter', return: 'Enter', escape: 'Escape', esc: 'Escape', tab: 'Tab',
      backspace: 'Backspace', delete: 'Delete', arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight' };
    const key = parts.pop(), modifiers = parts.map(p => aliases[p.toLowerCase()]);
    if (!key || modifiers.some(m => !m) || new Set(modifiers).size !== modifiers.length) throw new Error('Invalid hotkey');
    const normalizedKey = /^[a-z0-9]$/i.test(key) ? key.toUpperCase() : /^F(?:[1-9]|1\d|2[0-4])$/i.test(key) ? key.toUpperCase() : keyAliases[key.toLowerCase()];
    if (!normalizedKey) throw new Error('Invalid hotkey key');
    return [...['Ctrl', 'Alt', 'Shift', 'Meta'].filter(m => modifiers.includes(m)), normalizedKey].join('+');
  }
  function validate(value) {
    const errors = [], fail = message => errors.push(message);
    if (!plain(value)) return { ok: false, errors: ['Layout must be a JSON object'] };
    for (const key of Object.keys(value)) if (!['schemaVersion', 'id', 'name', 'slots'].includes(key)) fail(`Unsupported layout field: ${key}`);
    if (value.schemaVersion !== SCHEMA_VERSION) fail('Unsupported schemaVersion');
    if (!cleanText(value.id, 96) || !/^[\w.-]+$/.test(value.id)) fail('Invalid layout id');
    if (!cleanText(value.name, 80) || !value.name.trim()) fail('Layout name is required (up to 80 characters)');
    if (!Array.isArray(value.slots) || value.slots.length !== 32) return { ok: false, errors: [...errors, 'Layout must have exactly 32 slots'] };
    const ids = new Set(), hotkeys = new Set();
    const slots = value.slots.map((input, index) => {
      if (input === null) return null; // Real free key: not a ProTimer placeholder.
      if (!plain(input)) { fail(`Slot ${index + 1}: expected key or null`); return null; }
      for (const key of Object.keys(input)) if (!fields.has(key)) fail(`Slot ${index + 1}: unsupported field ${key}`);
      const key = { ...defaultKey(commandIds.has(input.command) ? input.command : 'empty'), ...input };
      if (!cleanText(key.id, 96) || !/^[\w.-]+$/.test(key.id) || ids.has(key.id)) fail(`Slot ${index + 1}: invalid or duplicate stable id`);
      ids.add(key.id);
      if (!commandIds.has(key.command)) fail(`Slot ${index + 1}: unsupported command`);
      if (!['selected', 't1', 't2'].includes(key.timerId)) fail(`Slot ${index + 1}: invalid timerId`);
      if (!['selected', 'set', 'live'].includes(key.target)) fail(`Slot ${index + 1}: invalid edit target`);
      if (!Number.isInteger(key.step) || key.step === 0 || Math.abs(key.step) > 359999) fail(`Slot ${index + 1}: invalid adjustment step`);
      if (!['h', 'm', 's'].includes(key.unit)) fail(`Slot ${index + 1}: invalid adjustment unit`);
      if (Number.isInteger(key.step) && Math.abs(key.step) * ({ h: 3600000, m: 60000, s: 1000 }[key.unit] || 0) > MAX_DURATION) fail(`Slot ${index + 1}: adjustment exceeds 99:59:59`);
      if (!Number.isInteger(key.durationMs) || key.durationMs < 0 || key.durationMs > MAX_DURATION || key.durationMs % 1000) fail(`Slot ${index + 1}: invalid preset duration`);
      if (!cleanText(key.name, 28)) fail(`Slot ${index + 1}: invalid key name`);
      if (typeof key.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(key.color)) fail(`Slot ${index + 1}: invalid color`);
      if (!icons.includes(key.icon)) fail(`Slot ${index + 1}: choose a built-in icon`);
      if (!Number.isInteger(key.textSize) || key.textSize < 12 || key.textSize > 28) fail(`Slot ${index + 1}: text size must be 12–28`);
      if (typeof key.stateDisplay !== 'boolean') fail(`Slot ${index + 1}: invalid stateDisplay`);
      if (!['short', 'hold', 'confirm'].includes(key.pressPolicy)) fail(`Slot ${index + 1}: invalid press policy`);
      if (['startSet', 'reset', 'blackout'].includes(key.command) && key.pressPolicy === 'short') fail(`Slot ${index + 1}: protected commands require hold or confirmation`);
      try { key.hotkey = normalizeHotkey(key.hotkey); } catch (error) { fail(`Slot ${index + 1}: ${error.message}`); }
      if (key.hotkey && hotkeys.has(key.hotkey)) fail(`Slot ${index + 1}: duplicate hotkey ${key.hotkey}`);
      if (key.hotkey && ['activeTime', 'setTime', 'empty'].includes(key.command)) fail(`Slot ${index + 1}: read-only keys cannot execute hotkeys`);
      hotkeys.add(key.hotkey);
      return key;
    });
    return errors.length ? { ok: false, errors } : { ok: true, errors, layout: { schemaVersion: SCHEMA_VERSION, id: value.id, name: value.name.trim(), slots } };
  }
  function normalize(value) { const result = validate(value); if (!result.ok) throw new Error(result.errors.join('; ')); return result.layout; }
  function validateKey(value) {
    if (value === null) return { ok: true, key: null, errors: [] };
    const result = validate({ schemaVersion: SCHEMA_VERSION, id: 'validate-key', name: 'Key', slots: [value, ...Array(31).fill(null)] });
    return result.ok ? { ok: true, key: result.layout.slots[0], errors: [] } : { ok: false, errors: result.errors };
  }
  function normalizeKey(value) { const result = validateKey(value); if (!result.ok) throw new Error(result.errors.join('; ')); return result.key; }
  function migrate(value) {
    // No guessed interpretation of unknown schemas. v0 was the prerelease data-only shape.
    if (plain(value) && value.schemaVersion === 0) return normalize({ ...value, schemaVersion: SCHEMA_VERSION });
    return normalize(value);
  }
  function defaultLayout(kind = 'standard') {
    if (!['standard', 'full'].includes(kind)) throw new Error('Unknown starter layout');
    const commands = [
      'startPause', 'startSet', 'activeTime', 'setTime', 'editTarget', 'reset', 'bell', null,
      'adjust', 'adjust', 'adjust', 'adjust', 'adjust', 'adjust', 'enterTime', null,
      'preset', 'preset', 'preset', 'preset', 'preset', 'countup', 'clock', null,
      'blackout', 'outputA', 'outputB', 'selectTimer', 'message', 'settings', 'back', null
    ];
    if (kind === 'full') [commands[7], commands[15], commands[23], commands[31]] = ['prev', 'next', 'loadSelected', 'fullscreen'];
    const slots = commands.map((command, i) => command ? defaultKey(command, { id: `protimer-slot-${i + 1}` }) : null);
    for (let i = 0; i < 6; i++) Object.assign(slots[8 + i], { step: i % 2 ? 1 : -1, unit: ['h', 'm', 's'][Math.floor(i / 2)] });
    [5, 10, 15, 30, 60].forEach((min, i) => { slots[16 + i].durationMs = min * 60000; });
    return { schemaVersion: SCHEMA_VERSION, id: `protimer-${kind}`, name: kind === 'full' ? 'Full 32' : 'Standard 28 + 4 free', slots };
  }
  function label(key) {
    if (!key) return 'FREE';
    if (key.name) return key.name;
    if (key.command === 'adjust') return `${key.step < 0 ? '−' : '+'}${Math.abs(key.step)}${key.unit}`;
    if (key.command === 'preset') {
      const sec = key.durationMs / 1000;
      return sec % 60 === 0 ? `${sec / 60} MIN` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    }
    return catalog.find(c => c.id === key.command)?.label || 'INACTIVE';
  }
  function createHistory(initial) {
    const entries = [normalize(initial)]; let position = 0;
    return {
      current: () => clone(entries[position]), canUndo: () => position > 0, canRedo: () => position < entries.length - 1,
      commit(value) { const next = normalize(value); if (JSON.stringify(next) === JSON.stringify(entries[position])) return this.current(); entries.splice(position + 1); entries.push(next); if (entries.length > 100) entries.shift(); position = entries.length - 1; return this.current(); },
      undo() { if (position > 0) position--; return this.current(); }, redo() { if (position < entries.length - 1) position++; return this.current(); }
    };
  }
  return { SCHEMA_VERSION, MAX_DURATION, catalog, icons, defaultKey, defaultLayout, validate, normalize, validateKey, normalizeKey, migrate, normalizeHotkey, label, createHistory };
});
