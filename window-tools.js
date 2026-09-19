const pendingExits = new WeakMap();
const siblingGuards = new WeakMap();

function preserveSiblingBounds(source, entering, { getSibling, screen, platform = process.platform }) {
  siblingGuards.get(source)?.();
  if (platform !== 'darwin' || source.isDestroyed() || source.isFullScreen() === entering) return;
  const sibling = getSibling?.(), win = sibling?.window;
  if (!win || win.isDestroyed() || win.isFullScreen()) return;
  const bounds = win.getBounds(), displayId = screen.getDisplayMatching(bounds).id;
  const trace = (phase, detail) => { if(process.argv.includes('--smoke')) console.log('SIBLING_FULLSCREEN', phase, JSON.stringify(detail)); };
  trace('begin',{entering,bounds,revision:sibling.revision});
  const event = entering ? 'enter-full-screen' : 'leave-full-screen';
  // AppKit can restore an old frame on another window when changing Spaces.
  // Preserve only this transition, never a later operator move/resize or reroute.
  let cancelled = false;
  const cancel = () => { cancelled = true; };
  const cleanup = () => {
    clearTimeout(timer);
    source.removeListener(event, finish);
    source.removeListener('closed', stop);
    win.removeListener('will-move', cancel);
    win.removeListener('will-resize', cancel);
    if (siblingGuards.get(source) === stop) siblingGuards.delete(source);
  };
  const stop = () => { cancel(); cleanup(); };
  const finish = () => setImmediate(() => {
    cleanup();
    const current = getSibling?.();
    trace('finish',{entering,cancelled,closed:win.isDestroyed(),fullscreen:!win.isDestroyed()&&win.isFullScreen(),bounds:!win.isDestroyed()&&win.getBounds(),revision:current?.revision});
    if (cancelled || source.isDestroyed() || win.isDestroyed() || win.isFullScreen() ||
        current?.window !== win || current.revision !== sibling.revision ||
        !screen.getAllDisplays().some(d => d.id === displayId)) return;
    const actual = win.getBounds();
    if (['x','y','width','height'].some(key => actual[key] !== bounds[key])) win.setBounds(bounds);
  });
  const timer = setTimeout(stop, 5000);
  source.once(event, finish);
  source.once('closed', stop);
  win.on('will-move', cancel);
  win.on('will-resize', cancel);
  siblingGuards.set(source, stop);
}

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

module.exports = { leaveFullscreen, preserveSiblingBounds };
