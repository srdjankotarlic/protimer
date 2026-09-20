// Shared, dependency-free timer/layout rules for desktop and phone views.
(function (root, factory) {
  const tools = factory();
  if (typeof module === 'object' && module.exports) module.exports = tools;
  else root.TimerTools = tools;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const MAX_DURATION = (99 * 3600 + 59 * 60 + 59) * 1000;
  function clamp(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  }
  function layout(value) {
    const v = value || {};
    return { scale: clamp(v.scale ?? 100, 10, 200, 100), x: clamp(v.x ?? 0, -100, 100, 0), y: clamp(v.y ?? 0, -100, 100, 0) };
  }
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
  function secondary(value, legacyGrid) {
    const v = value || {};
    const durationMs = clamp(v.durationMs ?? 600000, 1000, MAX_DURATION, 600000);
    // Saved settings intentionally never resume a running timer after relaunch.
    // Before independent placement, both outputs used the primary grid. Import
    // that grid once for old settings; later edits belong to this timer only.
    return { durationMs, remMs: durationMs, endAt: 0, running: false, layout: layout(v.layout), outputSize: size(v.outputSize),
      ...grid(Object.hasOwn(v, 'gridOn') ? v : legacyGrid) };
  }
  function remaining(timer, now) { return timer.running ? timer.endAt - now : timer.remMs; }
  function setRunning(timer, running, now) {
    if (timer.running === running) return;
    if (running) timer.endAt = now + timer.remMs;
    else timer.remMs = remaining(timer, now);
    timer.running = running;
  }
  function reset(timer) { timer.running = false; timer.remMs = timer.durationMs; timer.endAt = 0; }
  function separateOutputs(state) { return !!(state && state.dualTimer && state.separateOutputs); }
  // Project the existing clocks into desktop outputs; never start, pause or copy
  // a clock deadline. Network viewers keep the original combined state.
  function outputState(state, role = 'primary') {
    if (!state || !separateOutputs(state)) return state;
    if (role !== 'secondary') return { ...state, dualTimer: false, fitWindow: false };
    const timer = state.secondary;
    return {
      ...state, dualTimer: false, fitWindow: false, mode: 'countdown',
      durationMs: timer.durationMs, remMs: timer.remMs, endAt: timer.endAt,
      running: timer.running, elapsedMs: 0, startAt: 0,
      outputLayout: timer.layout, outputSize: size(timer.outputSize),
      ...grid(timer),
      text: '', textOnly: false, showNowNext: false
    };
  }
  return { MAX_DURATION, clamp, layout, size, grid, secondary, remaining, setRunning, reset, separateOutputs, outputState };
});
