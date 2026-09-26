(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.EngineClock = value;
})(globalThis, function () {
  'use strict';
  // Keep the existing absolute-deadline engine. Correct only detected system
  // clock jumps, once at the authority, so all clients receive the same state.
  function create({ wallNow = Date.now, monoNow = () => performance.now(), onJump }) {
    let wall = wallNow(), mono = monoNow(), suspended = false;
    return {
      sample() {
        const nextWall = wallNow(), nextMono = monoNow();
        const difference = (nextWall - wall) - (nextMono - mono);
        wall = nextWall; mono = nextMono;
        if (!suspended && Math.abs(difference) > 100) onJump(Math.round(difference));
        return nextWall;
      },
      suspend() { suspended = true; },
      resume() { wall = wallNow(); mono = monoNow(); suspended = false; }
    };
  }
  function shiftRunning(state, delta) {
    for (const timer of [state, state.secondary]) {
      if (!timer?.running || timer.mode === 'clock') continue;
      if (timer.mode === 'countup') timer.startAt += delta;
      else timer.endAt += delta;
    }
  }
  return { create, shiftRunning };
});
