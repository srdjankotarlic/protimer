// Shared, dependency-free timer/layout rules for desktop and phone views.
(function (root, factory) {
  const tools = factory();
  if (typeof module === 'object' && module.exports) module.exports = tools;
  else root.TimerTools = tools;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const MAX_DURATION = (99 * 3600 + 59 * 60 + 59) * 1000;
  // Upper bounds on tabular digit, colon and minus advances, in em.
  // Sizing uses the widest digit so the readout doesn't resize every second.
  const digitMetrics = Object.freeze({
    pixel:[.61,.25,.61], cyber:[.84,.24,.52], condensed:[.50,.28,.44],
    plex:[.6,.6,.6], space:[.62,.62,.62], bold:[.67,.34,.66],
    geist:[.70,.32,.55], serif:[.54,.30,.54], lexend:[.68,.26,.58]
  });
  function digitFont(value) {
    return typeof value === 'string' && Object.hasOwn(digitMetrics, value) ? value : 'default';
  }
  function digitFamily(value) {
    const font = digitFont(value);
    return font === 'default' ? '' : `"ProTimer ${font}", "SF Mono", ui-monospace, Menlo, monospace`;
  }
  function digitWidth(value, text, defaultAdvance = .6) {
    const metrics = digitMetrics[digitFont(value)];
    if (!metrics) return text.length * defaultAdvance;
    const [digit, colon, minus] = metrics;
    let width = 0;
    for (const character of text) width += character === ':' ? colon : /[−-]/.test(character) ? minus : digit;
    return width;
  }
  function clamp(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  }
  function layout(value) {
    const v = value || {};
    return { scale: clamp(v.scale ?? 100, 10, 200, 100), x: clamp(v.x ?? 0, -100, 100, 0), y: clamp(v.y ?? 0, -100, 100, 0) };
  }
  const freeElements = Object.freeze(['primary', 'secondary', 'title', 'message', 'rundown', 'progress']);
  function freePosition(element, dual = true, split = 'columns') {
    const rows = split === 'rows';
    return {
      primary: {x: dual && !rows ? -48 : 0, y: dual && rows ? -28 : -5, scale:100},
      secondary: {x: rows ? 0 : 48, y: rows ? 26 : -5, scale:100},
      title: {x:0,y:-80,scale:100}, message: {x:0,y:58,scale:100},
      rundown: {x:0,y:82,scale:100}, progress: {x:0,y:97,scale:100}
    }[element];
  }
  function freeLayout(value, dual, split) {
    return Object.fromEntries(freeElements.map(key => [key, layout({...freePosition(key, dual, split), ...value?.[key]})]));
  }
  function hasFreeLayout(state) { return state?.freeAudience === true && !separateOutputs(state) && !state.outputTimerId; }
  function size(value) {
    if (!value || !Number.isInteger(value.width) || !Number.isInteger(value.height) ||
        value.width < 80 || value.height < 60 || value.width > 7680 || value.height > 4320) return null;
    return { width: value.width, height: value.height };
  }
  function grid(value) {
    const v = value || {}, gridSize = [3, 5, 7, 9].includes(v.gridSize) ? v.gridSize : 3;
    const gridCell = Number.isInteger(v.gridCell) ? clamp(v.gridCell, 0, gridSize * gridSize - 1, 0) : Math.floor(gridSize * gridSize / 2);
    return { gridOn: !!v.gridOn, gridSize, gridCell };
  }
  function outputLayer(value) { return ['auto', 'above', 'normal'].includes(value) ? value : 'auto'; }
  function outputOnTop(state = {}) {
    const layer = outputLayer(state.outputLayer);
    return layer === 'above' || (layer === 'auto' && !!(state.transparent || state.gridOn));
  }
  function secondary(value, legacyGrid) {
    const v = value || {};
    const mode = ['countdown', 'countup', 'clock'].includes(v.mode) ? v.mode : 'countdown';
    const durationMs = clamp(v.durationMs ?? 600000, mode === 'countdown' ? 1000 : 0, MAX_DURATION, 600000);
    // Saved settings intentionally never resume a running timer after relaunch.
    // Before independent placement, both outputs used the primary grid. Import
    // that grid once for old settings; later edits belong to this timer only.
    // Migrate overtime and the visual alert once too; secondary audio remains opt-in.
    return { mode, durationMs, remMs: durationMs, endAt: 0, elapsedMs: 0, startAt: 0, running: false, layout: layout(v.layout), outputSize: size(v.outputSize), outputLayer: outputLayer(v.outputLayer),
      overtime: !!(v.overtime ?? legacyGrid?.overtime ?? true),
      flashZero: !!(v.flashZero ?? legacyGrid?.flashZero ?? true), soundZero: !!(v.soundZero ?? false),
      ...grid(Object.hasOwn(v, 'gridOn') ? v : legacyGrid) };
  }
  function remaining(timer, now) { return timer.running ? timer.endAt - now : timer.remMs; }
  function elapsed(timer, now) { return (timer.elapsedMs || 0) + (timer.running ? now - timer.startAt : 0); }
  function setRunning(timer, running, now) {
    if (timer.mode === 'clock') return; // A clock display has no transport/deadline.
    if (timer.running === running) return;
    if (timer.mode === 'countup') {
      if (running) timer.startAt = now;
      else timer.elapsedMs = elapsed(timer, now);
    } else if (running) timer.endAt = now + timer.remMs;
    else timer.remMs = remaining(timer, now);
    timer.running = running;
  }
  function reset(timer) { timer.running = false; timer.remMs = timer.durationMs; timer.endAt = 0; timer.elapsedMs = 0; timer.startAt = 0; }
  function separateOutputs(state) { return !!(state && state.dualTimer && state.separateOutputs); }
  function liveView(value){ return ['t1','t2','both'].includes(value)?value:'both'; }
  function secondaryView(state){
    const timer=state.secondary;
    const free = hasFreeLayout(state) ? freeLayout(state.freeLayout, true, state.dualSplit) : null;
    return {...state,dualTimer:false,fitWindow:false,mode:timer.mode||'countdown',
      ...(free && {freeLayout:{...free,primary:free.secondary}}),
      durationMs:timer.durationMs,remMs:timer.remMs,endAt:timer.endAt,running:timer.running,
      elapsedMs:timer.elapsedMs||0,startAt:timer.startAt||0,overtime:timer.overtime??state.overtime,
      flashZero:timer.flashZero??state.flashZero??true,soundZero:!!timer.soundZero,
      outputLayout:timer.layout,outputSize:size(timer.outputSize),...grid(timer),text:'',textOnly:false,showNowNext:false};
  }
  // Presentation only: never mutate either timer, routing or window lifecycle.
  function audienceState(state){
    if(!state)return state;
    const view=liveView(state.liveTimerView);
    if(state.outputTimerId)return {...state,liveHidden:view!=='both'&&view!==state.outputTimerId};
    if(!state.dualTimer||view==='both')return state;
    return view==='t1'?{...state,dualTimer:false,fitWindow:false,
      ...(hasFreeLayout(state) && {freeLayout:freeLayout(state.freeLayout,true,state.dualSplit)})}:secondaryView(state);
  }
  // Project the existing clocks into desktop outputs; never start, pause or copy
  // a clock deadline. Network viewers keep the original combined state.
  function outputState(state, role = 'primary') {
    if (!state || !separateOutputs(state)) return state;
    if (role !== 'secondary') return { ...state, dualTimer: false, fitWindow: false,outputTimerId:'t1' };
    const timer = state.secondary;
    return {
      ...state, dualTimer: false, fitWindow: false,outputTimerId:'t2', mode: timer.mode || 'countdown',
      durationMs: timer.durationMs, remMs: timer.remMs, endAt: timer.endAt,
      running: timer.running, elapsedMs: timer.elapsedMs || 0, startAt: timer.startAt || 0,
      overtime: timer.overtime ?? state.overtime,
      flashZero: timer.flashZero ?? state.flashZero ?? true, soundZero: !!timer.soundZero,
      outputLayout: timer.layout, outputSize: size(timer.outputSize), outputLayer: outputLayer(timer.outputLayer),
      ...grid(timer),
      text: '', textOnly: false, showNowNext: false
    };
  }
  return { MAX_DURATION, digitFont, digitFamily, digitWidth, clamp, layout, freeElements, freePosition, freeLayout, hasFreeLayout, size, grid, outputLayer, outputOnTop, secondary, remaining, elapsed, setRunning, reset, separateOutputs, outputState,liveView,audienceState };
});
