const path = require('path');
const TimerTools = require('./timer-tools');
const { leaveFullscreen, preserveSiblingBounds } = require('./window-tools');

// A second desktop output only. The existing output, LAN/OBS streams and timer
// transport remain owned by their original paths.
module.exports = function secondaryOutput({ BrowserWindow, screen, getState, controlDisplayId, changed, getSibling }) {
  let win = null, targetId = null, revision = 0, transparent = false, placed = false, placing = null, ready = false;
  const state = () => TimerTools.outputState(getState(), 'secondary');
  const enabled = () => TimerTools.separateOutputs(getState());
  const notify = () => { changed(); };
  const protectSibling = (current, entering) => preserveSiblingBounds(current, entering, {getSibling,screen});
  function geometry() {
    if (!win || win.isDestroyed()) return null;
    const [width, height] = win.getContentSize();
    return { width, height, fullscreen: win.isFullScreen(), displayId: targetId,
      scaleFactor: screen.getDisplayMatching(win.getBounds()).scaleFactor };
  }
  function mode() {
    if (win && !win.isDestroyed()) win.webContents.send('win-fs', win.isFullScreen());
    notify();
  }
  async function position(target) {
    const current = win, version = ++revision;
    placing = version;
    targetId = target.id;
    if (current && !current.isDestroyed()) protectSibling(current, false);
    if (!current || current.isDestroyed() || !await leaveFullscreen(current) ||
        win !== current || version !== revision) { if (placing === version) placing = null; return; }
    const s = state();
    if (!enabled()) { if (placing === version) placing = null; return; }
    if (s.gridOn && s.gridSize) {
      const n = s.gridSize, cell = Math.max(0, Math.min(n * n - 1, s.gridCell || 0));
      const b = target.bounds, width = Math.floor(b.width / n), height = Math.floor(b.height / n);
      current.setBounds({ x: b.x + (cell % n) * width, y: b.y + Math.floor(cell / n) * height, width, height });
    } else if (TimerTools.size(s.outputSize)) {
      current.setBounds({ x: target.workArea.x, y: target.workArea.y, ...s.outputSize });
    } else if (target.id !== controlDisplayId()) {
      current.setBounds(target.bounds);
      protectSibling(current, true);
      current.setFullScreen(true);
    } else {
      const b = target.workArea, width = Math.min(900, Math.floor(b.width * .45));
      current.setBounds({ x: b.x + 24, y: b.y + 48, width, height: Math.floor(width * 9 / 16) });
    }
    current.show();
    placed = true;
    if (placing === version) placing = null;
    mode();
  }
  function open(displayId) {
    const target = screen.getAllDisplays().find(d => d.id === displayId);
    // A disconnected/stale selection must never silently appear on another TV.
    if (!enabled() || !target) return { ok: false };
    targetId = target.id;
    if (win && !win.isDestroyed()) { if (ready) position(target); return { ok: true }; }
    const s = state();
    transparent = !!s.transparent;
    const current = new BrowserWindow({
      width: 900, height: 506, minWidth: 80, minHeight: 60, show: false,
      title: 'ProTimer — Tajmer 2', backgroundColor: transparent ? '#00000000' : '#000000',
      transparent, frame: false, hasShadow: false, movable: true, resizable: true,
      enableLargerThanScreen: true, alwaysOnTop: transparent || !!s.gridOn,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
    });
    win = current;
    placed = false; ready = false;
    if (transparent || s.gridOn) current.setAlwaysOnTop(true, 'floating');
    current.webContents.on('did-finish-load', () => {
      if (win !== current) return;
      current.webContents.send('state', state()); mode();
    });
    current.once('ready-to-show', () => {
      if (win !== current) return;
      ready = true;
      const selected = screen.getAllDisplays().find(d => d.id === targetId);
      if (win === current && selected) position(selected);
    });
    current.on('enter-full-screen', () => setImmediate(mode));
    current.on('leave-full-screen', () => setImmediate(mode));
    current.on('resize', notify);
    current.on('move', () => {
      // Ignore initial/native placement and OS relocation after unplugging a
      // display. Only an operator drag may change a still-connected target.
      if (win === current && placed && placing === null && screen.getAllDisplays().some(d => d.id === targetId))
        targetId = screen.getDisplayMatching(current.getBounds()).id;
      notify();
    });
    current.on('closed', () => {
      if (win === current) { win = null; targetId = null; placed = false; ready = false; placing = null; ++revision; notify(); }
    });
    current.loadFile('output.html');
    notify();
    return { ok: true };
  }
  function close() {
    ++revision;
    if (win && !win.isDestroyed()) win.destroy();
  }
  function update(previous) {
    if (!enabled()) { close(); return; }
    if (!win || win.isDestroyed()) return; // Enabling/restoring a mode never opens a TV.
    const s = state();
    if (!!s.transparent !== transparent) {
      const id = targetId;
      close(); open(id); return;
    }
    win.setAlwaysOnTop(!!s.transparent || !!s.gridOn, 'floating');
    win.webContents.send('state', s);
    if (!!previous.gridOn !== !!s.gridOn || (s.gridOn &&
        (previous.gridSize !== s.gridSize || previous.gridCell !== s.gridCell))) {
      const target = screen.getAllDisplays().find(d => d.id === targetId);
      if (target) position(target);
    }
  }
  async function resize(requested) {
    const size = TimerTools.size(requested);
    if (!enabled() || !size) return { ok: false };
    if (!win || win.isDestroyed()) {
      if (!open(requested.displayId).ok) return { ok: false };
      const current = win;
      await new Promise(resolve => { current.once('ready-to-show', resolve); current.once('closed', resolve); });
    }
    const current = win, version = ++revision;
    if (current && !current.isDestroyed()) protectSibling(current, false);
    if (!current || !await leaveFullscreen(current) || win !== current ||
        version !== revision || !enabled() || state().gridOn) return { ok: false };
    current.setContentSize(size.width, size.height);
    const actual = geometry();
    notify();
    return { ok: !!actual && actual.width === size.width && actual.height === size.height, ...actual };
  }
  function displaysChanged() {
    if (win && !screen.getAllDisplays().some(d => d.id === targetId)) close();
  }
  return { open, close, update, resize, geometry, displaysChanged, getWindow: () => win, getRevision: () => revision,
    toggleFullscreen() {
      if (win && !win.isDestroyed()) { const entering=!win.isFullScreen(); protectSibling(win, entering); win.setFullScreen(entering); }
    } };
};
