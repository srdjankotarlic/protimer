const pendingExits = new WeakMap();
const siblingGuards = new WeakMap();

function isFullscreen(win) {
  return win.isFullScreen() || !!win.isSimpleFullScreen?.();
}
function setPresentationFullscreen(win, entering, simple = false, platform = process.platform) {
  if (platform === 'darwin' && (simple || win.isSimpleFullScreen?.()) && win.setSimpleFullScreen)
    win.setSimpleFullScreen(entering);
  else win.setFullScreen(entering);
}

function preserveSiblingBounds(source, entering, { getSibling, screen, platform = process.platform }) {
  siblingGuards.get(source)?.();
  if (platform !== 'darwin' || source.isDestroyed() || source.isFullScreen() === entering) return;
  const sibling = getSibling?.(), win = sibling?.window;
  if (!win || win.isDestroyed() || isFullscreen(win)) return;
  const bounds = win.getBounds(), displayId = screen.getDisplayMatching(bounds).id;
  const trace = (phase, detail) => { if(process.argv.includes('--smoke')) console.log('SIBLING_FULLSCREEN', phase, JSON.stringify(detail)); };
  trace('begin',{entering,bounds,revision:sibling.revision});
  const event = entering ? 'enter-full-screen' : 'leave-full-screen';
  // AppKit can restore an old frame on another window when changing Spaces.
  // Preserve only this transition, never a later operator move/resize or reroute.
  let cancelled = false;
  const cancel = () => { cancelled = true; };
  // AppKit also emits will-move/will-resize for a background window while
  // switching Spaces. A real mouse adjustment activates that sibling first.
  const operatorChange = () => { if (win.isFocused()) cancel(); };
  const cleanup = () => {
    clearTimeout(timer);
    source.removeListener(event, finish);
    source.removeListener('closed', stop);
    win.removeListener('will-move', operatorChange);
    win.removeListener('will-resize', operatorChange);
    if (siblingGuards.get(source) === stop) siblingGuards.delete(source);
  };
  const stop = () => { cancel(); cleanup(); };
  const finish = () => setImmediate(() => {
    cleanup();
    const current = getSibling?.();
    trace('finish',{entering,cancelled,closed:win.isDestroyed(),fullscreen:!win.isDestroyed()&&win.isFullScreen(),bounds:!win.isDestroyed()&&win.getBounds(),revision:current?.revision});
    if (cancelled || source.isDestroyed() || win.isDestroyed() || isFullscreen(win) ||
        current?.window !== win || current.revision !== sibling.revision ||
        !screen.getAllDisplays().some(d => d.id === displayId)) return;
    const actual = win.getBounds();
    if (['x','y','width','height'].some(key => actual[key] !== bounds[key])) win.setBounds(bounds);
  });
  const timer = setTimeout(stop, 5000);
  source.once(event, finish);
  source.once('closed', stop);
  win.on('will-move', operatorChange);
  win.on('will-resize', operatorChange);
  siblingGuards.set(source, stop);
}

function leaveFullscreen(win, timeoutMs = 4000) {
  if (win.isDestroyed()) return Promise.resolve(false);
  if (win.isSimpleFullScreen?.()) {
    win.setSimpleFullScreen(false);
    return Promise.resolve(!isFullscreen(win));
  }
  if (pendingExits.has(win)) return pendingExits.get(win);
  if (!win.isFullScreen()) return Promise.resolve(true);
  let complete;
  const pending = new Promise(resolve => { complete = resolve; });
  pendingExits.set(win, pending);
  let settled = false, quietTimer;
  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    clearTimeout(quietTimer);
    pendingExits.delete(win);
    win.removeListener('leave-full-screen', onLeave);
    win.removeListener('closed', onLeave);
    win.removeListener('resize', onResize);
    complete(!win.isDestroyed() && !win.isFullScreen());
  };
  // Windows can emit the native event before updating isFullScreen(). Read the
  // state on the next turn, not inside that event or before registering pending.
  // Native restoration can emit leave-full-screen before restoring its frame
  // (Windows). Wait for a short quiet geometry interval before resizing, rather
  // than letting the OS overwrite the caller's new content size afterwards.
  let left = false;
  const settleGeometry = () => { clearTimeout(quietTimer); quietTimer = setTimeout(finish, 150); };
  const onLeave = () => { left = true; setImmediate(settleGeometry); };
  const onResize = () => { if (left) settleGeometry(); };
  const timer = setTimeout(finish, timeoutMs);
  win.once('leave-full-screen', onLeave);
  win.once('closed', onLeave);
  win.on('resize', onResize);
  try { win.setFullScreen(false); } catch (_) { setImmediate(finish); }
  return pending;
}

async function applyContentSize(win, size, {platform = process.platform, valid = () => true} = {}) {
  const matches = () => win.getContentSize().every((n,i) => n === [size.width,size.height][i]);
  // A Windows fullscreen event/flag can precede the native widget's restored
  // frame. A size issued inside that interval is discarded, not queued. Retry
  // only this explicit request, with a bounded deadline and identity/revision
  // guard. Never replay a superseded operator action or change timer state.
  for (let attempt=0; attempt<(platform==='win32'?8:1); attempt++) {
    if (win.isDestroyed() || !valid() || isFullscreen(win)) return false;
    win.setContentSize(size.width,size.height);
    if (matches()) return true;
    if (platform!=='win32') return false;
    win.setBounds({...win.getBounds(),...size});
    if (matches()) return true;
    await new Promise(resolve => setTimeout(resolve,100));
  }
  return !win.isDestroyed() && valid() && matches();
}

module.exports = { leaveFullscreen, preserveSiblingBounds, isFullscreen, setPresentationFullscreen, applyContentSize };
