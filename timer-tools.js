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
  function secondary(value) {
    const v = value || {};
    const durationMs = clamp(v.durationMs ?? 600000, 1000, MAX_DURATION, 600000);
    // Saved settings intentionally never resume a running timer after relaunch.
    return { durationMs, remMs: durationMs, endAt: 0, running: false, layout: layout(v.layout) };
  }
  function remaining(timer, now) { return timer.running ? timer.endAt - now : timer.remMs; }
  function setRunning(timer, running, now) {
    if (timer.running === running) return;
    if (running) timer.endAt = now + timer.remMs;
    else timer.remMs = remaining(timer, now);
    timer.running = running;
  }
  function reset(timer) { timer.running = false; timer.remMs = timer.durationMs; timer.endAt = 0; }
  return { MAX_DURATION, clamp, layout, size, secondary, remaining, setRunning, reset };
});
