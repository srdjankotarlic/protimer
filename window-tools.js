const pendingExits = new WeakMap();

function leaveFullscreen(win, timeoutMs = 4000) {
  if (win.isDestroyed()) return Promise.resolve(false);
  if (pendingExits.has(win)) return pendingExits.get(win);
  if (!win.isFullScreen()) return Promise.resolve(true);
  let complete;
  const pending = new Promise(resolve => { complete = resolve; });
  pendingExits.set(win, pending);
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    pendingExits.delete(win);
    win.removeListener('leave-full-screen', onLeave);
    win.removeListener('closed', onLeave);
    complete(!win.isDestroyed() && !win.isFullScreen());
  };
  // Windows can emit the native event before updating isFullScreen(). Read the
  // state on the next turn, not inside that event or before registering pending.
  const onLeave = () => setImmediate(finish);
  const timer = setTimeout(finish, timeoutMs);
  win.once('leave-full-screen', onLeave);
  win.once('closed', onLeave);
  try { win.setFullScreen(false); } catch (_) { setImmediate(finish); }
  return pending;
}

module.exports = { leaveFullscreen };
