// Observe the host clocks without changing their deadlines or playing audio.
(function (root, factory) {
  const alerts = factory();
  if (typeof module === 'object' && module.exports) module.exports = alerts;
  else root.TimerAlerts = alerts;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  function createZeroTracker() {
    const armed = { t1: false, t2: false };

    function observe(id, timer, enabled, now, events) {
      if (!enabled || !timer || timer.mode !== 'countdown') {
        armed[id] = false;
        return;
      }
      const remaining = timer.running ? timer.endAt - now : timer.remMs;
      if (!Number.isFinite(remaining)) {
        armed[id] = false;
        return;
      }
      if (remaining > 0) {
        armed[id] = true;
        return;
      }
      // Consume the crossing even when paused at zero or sound is disabled.
      // Only a newly observed positive duration can arm another crossing.
      if (armed[id] && timer.running) events.push(id);
      armed[id] = false;
    }

    return {
      sample(state, now) {
        const events = [];
        observe('t1', state, !!state, now, events);
        observe('t2', state?.secondary, !!state?.dualTimer, now, events);
        return events;
      }
    };
  }

  return { createZeroTracker };
});
