// Data-only layout schema. This module never executes commands or owns physical keys.
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else { root.DeckLayout = value; root.ProTimerDeckLayout = value; }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SCHEMA_VERSION = 1, MAX_DURATION = 359999000;
  const definitions = [
    ['startPause', 'START / PAUSE'], ['startSet', 'START SET', 'protected'], ['loadSet','LOAD READY','protected'],
    ['activeTime', 'ACTIVE TIME', 'display'], ['setTime', 'SET TIME', 'display'],
    ['editTarget', 'EDIT SET / LIVE'], ['reset', 'RESET', 'protected'], ['bell', 'BELL'],
    ['adjust', 'ADJUST'], ['preset', 'PRESET'], ['enterTime', 'ENTER TIME'],
    ['countdown', 'COUNTDOWN'], ['countup', 'COUNT UP'], ['clock', 'CLOCK'],
    ['blackout', 'BLACK', 'protected'], ['outputA', 'OUT A'], ['outputB', 'OUT B'],
    ['blackoutOn', 'BLACK ON', 'protected'], ['blackoutOff', 'BLACK OFF', 'protected'],
    ['liveT1','LIVE T1'],['liveBoth','LIVE T1 + T2'],['liveT2','LIVE T2'],
    ['selectTimer', 'TIMER 1 / 2'], ['message', 'MESSAGE'], ['settings', 'SETTINGS'],
    ['back', 'BACK'], ['prev', 'PREV'], ['next', 'NEXT'], ['loadSelected', 'LOAD SELECTED'],
    ['fullscreen', 'FULLSCREEN'], ['start', 'PLAY ACTIVE'], ['pause', 'PAUSE'], ['resume', 'RESUME'],
    ['clearSet', 'CLEAR SET'], ['empty', 'INACTIVE SLOT', 'display']
  ];
  const catalog = Object.freeze(definitions.map(([id, label, kind]) => Object.freeze({ id, label,
    kind: kind || 'command', protected: kind === 'protected', executable: kind !== 'display' })));
  const commandIds = new Set(catalog.map(c => c.id));
  const icons = Object.freeze(['none', 'play', 'pause', 'stop', 'reset', 'bell', 'plus', 'minus', 'clock', 'timer',
    'screen', 'grid', 'message', 'settings', 'back', 'up', 'down', 'left', 'right', 'lock', 'edit']);
  const fields = new Set(['id', 'command', 'timerId', 'target', 'step', 'unit', 'durationMs', 'name', 'color',
    'icon', 'textSize', 'stateDisplay', 'hotkey', 'pressPolicy', 'outputAction']);
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
      textSize: 18, stateDisplay: true, hotkey: '', outputAction: 'toggle', pressPolicy: 'short', ...overrides };
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
      if (!['open', 'close', 'toggle'].includes(key.outputAction)) fail(`Slot ${index + 1}: invalid output operation`);
      if (!['short', 'hold', 'confirm'].includes(key.pressPolicy)) fail(`Slot ${index + 1}: invalid press policy`);
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
    const valid = normalize(plain(value) && value.schemaVersion === 0 ? { ...value, schemaVersion: SCHEMA_VERSION } : value);
    // Upgrade only an untouched starter board. A user-edited layout, including
    // an intentional hold policy or BACK key, must remain exactly as saved.
    for (const kind of ['standard', 'full']) {
      for (const back of [true, false]) {
        const old = legacyLayout(kind);
        old.slots[1].pressPolicy = back ? 'hold' : 'short';
        old.slots[30] = defaultKey(back ? 'back' : 'clearSet', { id: 'protimer-slot-31' });
        if (JSON.stringify(valid) === JSON.stringify(old)) return defaultLayout(kind);
      }
      const previous = previousLayout(kind);
      previous.slots[5].pressPolicy='hold';previous.slots[28].pressPolicy='hold';
      if(JSON.stringify(valid)===JSON.stringify(previous))return defaultLayout(kind);
      if(JSON.stringify(valid)===JSON.stringify(previousLayout(kind)))return defaultLayout(kind);
      const lastStarter=defaultLayout(kind);lastStarter.slots[2]=defaultKey('resume',{id:'protimer-slot-3'});
      if(JSON.stringify(valid)===JSON.stringify(lastStarter))return defaultLayout(kind);
    }
    return valid;
  }
  function legacyLayout(kind = 'standard') {
    if (!['standard', 'full'].includes(kind)) throw new Error('Unknown starter layout');
    const commands = [
      'startPause', 'startSet', 'activeTime', 'setTime', 'editTarget', 'reset', 'bell', null,
      'adjust', 'adjust', 'adjust', 'adjust', 'adjust', 'adjust', 'enterTime', null,
      'preset', 'preset', 'preset', 'preset', 'preset', 'countup', 'clock', null,
      'blackout', 'outputA', 'outputB', 'selectTimer', 'message', 'settings', 'clearSet', null
    ];
    if (kind === 'full') [commands[7], commands[15], commands[23], commands[31]] = ['prev', 'next', 'loadSelected', 'fullscreen'];
    const slots = commands.map((command, i) => command ? defaultKey(command, { id: `protimer-slot-${i + 1}` }) : null);
    slots.filter(key=>key&&['reset','blackout'].includes(key.command)).forEach(key=>{key.pressPolicy='hold';});
    for (let i = 0; i < 6; i++) Object.assign(slots[8 + i], { step: i % 2 ? 1 : -1, unit: ['h', 'm', 's'][Math.floor(i / 2)] });
    [5, 10, 15, 30, 60].forEach((min, i) => { slots[16 + i].durationMs = min * 60000; });
    return { schemaVersion: SCHEMA_VERSION, id: `protimer-${kind}`, name: kind === 'full' ? 'Full 32' : 'Standard 28 + 4 free', slots };
  }
  function previousLayout(kind = 'standard') {
    const board = legacyLayout(kind);
    const commands = ['startSet','pause','resume','activeTime','setTime','reset','bell',null,
      'adjust','adjust','adjust','adjust','adjust','adjust','enterTime',null,
      'preset','preset','preset','preset','preset','countup','clock',null,
      'selectTimer','selectTimer','outputA','outputB','blackout','message','clearSet',null];
    if (kind === 'full') [commands[7],commands[15],commands[23],commands[31]] = ['countdown','loadSelected','settings','fullscreen'];
    board.slots = commands.map((command,i) => command ? defaultKey(command,{id:`protimer-slot-${i+1}`}) : null);
    for(let i=0;i<6;i++) Object.assign(board.slots[8+i], {step:i%2?1:-1,unit:['h','m','s'][Math.floor(i/2)],target:'set'});
    [5,10,15,30,60].forEach((min,i)=>{board.slots[16+i].durationMs=min*60000;});
    board.slots[24].timerId='t1'; board.slots[25].timerId='t2';
    board.slots[26].outputAction='open'; board.slots[27].outputAction='open';
    return board;
  }
  function defaultLayout(kind = 'standard') {
    const board=previousLayout(kind);
    board.slots[2]=defaultKey('start',{id:'protimer-slot-3'});
    board.slots[28]=defaultKey('blackoutOn',{id:'protimer-slot-29'});
    board.slots[29]=defaultKey('blackoutOff',{id:'protimer-slot-30'});
    if(kind==='full')for(const [index,command] of [[7,'loadSet'],[15,'liveT1'],[23,'liveBoth'],[31,'liveT2']])board.slots[index]=defaultKey(command,{id:`protimer-slot-${index+1}`});
    return board;
  }
  function label(key) {
    if (!key) return 'FREE';
    if (key.name) return key.name;
    if (key.command === 'selectTimer' && key.timerId !== 'selected') return key.timerId === 't1' ? 'TIMER 1' : 'TIMER 2';
    if (key.command === 'countup') return 'SET UP';
    if (key.command === 'clock') return 'SET CLOCK';
    if (key.command === 'countdown') return 'SET DOWN';
    if (key.command === 'message') return 'EDIT MSG';
    if (key.command === 'start') return 'PLAY ACTIVE';
    if (key.command === 'adjust') return `${key.step < 0 ? '−' : '+'}${Math.abs(key.step)}${key.unit}`;
    if (key.command === 'preset') {
      const sec = key.durationMs / 1000;
      return sec % 60 === 0 ? `${sec / 60} MIN` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    }
    return catalog.find(c => c.id === key.command)?.label || 'INACTIVE';
  }
  function commandIcon(key) {
    if(key.icon && key.icon !== 'none') return key.icon;
    return ({loadSet:'right',startSet:'play',start:'play',resume:'play',startPause:'play',pause:'pause',reset:'reset',bell:'bell',
      activeTime:'timer',setTime:'edit',adjust:key.step<0?'minus':'plus',preset:'timer',enterTime:'grid',
      countdown:'down',countup:'up',clock:'clock',blackout:'stop',blackoutOn:'stop',blackoutOff:'screen',outputA:'screen',outputB:'screen',liveT1:'screen',liveT2:'screen',liveBoth:'grid',
      selectTimer:'timer',message:'message',settings:'settings',back:'back',prev:'left',next:'right',
      loadSelected:'down',fullscreen:'screen',clearSet:'reset',editTarget:'edit'})[key.command] || 'grid';
  }
  function iconSvg(icon) {
    const paths={play:'<path d="M9 5 24 16 9 27Z" fill="currentColor" stroke="none"/>',
      pause:'<path d="M10 6v20M22 6v20" stroke-width="5"/>',stop:'<rect x="7" y="7" width="18" height="18" rx="2" fill="currentColor" stroke="none"/>',
      plus:'<path d="M16 6v20M6 16h20"/>',minus:'<path d="M6 16h20"/>',
      reset:'<path d="M7 10a11 11 0 1 1-1 10M7 4v8H1"/>',bell:'<path d="M9 12a7 7 0 0 1 14 0v8l3 4H6l3-4Zm4 16h6M16 3v2"/>',
      timer:'<circle cx="16" cy="18" r="11"/><path d="M16 18v-7M12 2h8M16 2v5M25 7l3 3"/>',
      clock:'<circle cx="16" cy="16" r="12"/><path d="M16 7v9l6 4"/>',
      screen:'<rect x="3" y="5" width="26" height="18" rx="3"/><path d="M16 23v5M10 28h12"/>',
      grid:'<rect x="4" y="4" width="24" height="24" rx="3"/><path d="M12 4v24M20 4v24M4 12h24M4 20h24"/>',
      message:'<path d="M5 5h22v17H14l-8 6v-6H5Z"/><path d="M10 11h12M10 16h8"/>',
      edit:'<path d="m7 23 1-7L22 2l7 7-14 14-8 1ZM18 6l7 7M5 29h23"/>',
      up:'<path d="M16 27V5M6 15 16 5l10 10"/>',down:'<path d="M16 5v22M6 17l10 10 10-10"/>',
      left:'<path d="M27 16H5M15 6 5 16l10 10"/>',right:'<path d="M5 16h22M17 6l10 10-10 10"/>',
      back:'<path d="M13 7 4 16l9 9M4 16h17a7 7 0 0 1 0 14"/>',
      lock:'<rect x="6" y="13" width="20" height="16" rx="3"/><path d="M10 13V8a6 6 0 0 1 12 0v5M16 19v4"/>',
      settings:'<circle cx="16" cy="16" r="5"/><path d="m13 3 6 0 1 4 4 2 4-1 3 5-3 3v4l3 3-3 5-4-1-4 2-1 4h-6l-1-4-4-2-4 1-3-5 3-3v-4l-3-3 3-5 4 1 4-2Z" transform="translate(1 -1) scale(.94)"/>'};
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${paths[icon]||''}</svg>`;
  }
  function createHistory(initial) {
    const entries = [normalize(initial)]; let position = 0;
    return {
      current: () => clone(entries[position]), canUndo: () => position > 0, canRedo: () => position < entries.length - 1,
      commit(value) { const next = normalize(value); if (JSON.stringify(next) === JSON.stringify(entries[position])) return this.current(); entries.splice(position + 1); entries.push(next); if (entries.length > 100) entries.shift(); position = entries.length - 1; return this.current(); },
      undo() { if (position > 0) position--; return this.current(); }, redo() { if (position < entries.length - 1) position++; return this.current(); }
    };
  }
  return { SCHEMA_VERSION, MAX_DURATION, catalog, icons, defaultKey, defaultLayout, validate, normalize, validateKey, normalizeKey, migrate, normalizeHotkey, label, commandIcon, iconSvg, createHistory };
});
