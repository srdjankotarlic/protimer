const path = require('path');
const TimerTools = require('./timer-tools');
const { leaveFullscreen, preserveSiblingBounds, isFullscreen, setPresentationFullscreen } = require('./window-tools');
const OutputQuality = require('./output-quality');

// A second desktop output only. The existing output, LAN/OBS streams and timer
// transport remain owned by their original paths.
module.exports = function secondaryOutput({ BrowserWindow, screen, getState, controlDisplayId, changed, getSibling, platform = process.platform }) {
  let win = null, targetId = null, revision = 0, transparent = false, placed = false, placing = null, ready = false;
  let requestedPresentation = 'configured';
  const state = () => TimerTools.outputState(getState(), 'secondary');
  const enabled = () => TimerTools.separateOutputs(getState());
  const notify = () => { changed(); };
  const protectSibling = (current, entering) => preserveSiblingBounds(current, entering, {getSibling,screen});
  function geometry() {
    return OutputQuality.outputGeometry(win, screen);
  }
  function mode() {
    if (win && !win.isDestroyed()) win.webContents.send('win-fs', isFullscreen(win));
    notify();
  }
  async function position(target, presentation = 'configured') {
    if (presentation === 'fullscreen' && ready && placed && placing === null &&
        win && !win.isDestroyed() && isFullscreen(win) && screen.getDisplayMatching(win.getBounds()).id === target.id) {
      targetId = target.id; win.show(); mode(); return;
    }
    const current = win, version = ++revision;
    placing = version;
    targetId = target.id;
    if (current && !current.isDestroyed()) protectSibling(current, false);
    if (!current || current.isDestroyed() || !await leaveFullscreen(current) ||
        win !== current || version !== revision) { if (placing === version) placing = null; return; }
    target = screen.getAllDisplays().find(display => display.id === target.id);
    if (!target) { if (placing === version) placing = null; return; }
    const s = state();
    if (!enabled()) { if (placing === version) placing = null; return; }
    if (presentation === 'fullscreen') {
      current.setBounds(target.bounds);
      setPresentationFullscreen(current, true, true, platform);
    } else if (s.gridOn && s.gridSize) {
      current.setBounds(OutputQuality.gridBounds(target, s));
    } else if (TimerTools.size(s.outputSize)) {
      current.setBounds({ x: target.workArea.x, y: target.workArea.y, ...s.outputSize });
    } else if (presentation !== 'window' && target.id !== controlDisplayId()) {
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
  function open(displayId, presentation = 'configured') {
    const target = screen.getAllDisplays().find(d => d.id === displayId);
    // A disconnected/stale selection must never silently appear on another TV.
    if (!enabled() || !target) return { ok: false };
    targetId = target.id;
    requestedPresentation = presentation;
    if (win && !win.isDestroyed()) { if (ready) position(target, presentation); return { ok: true }; }
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
      if (win === current && selected) position(selected, requestedPresentation);
    });
    current.on('enter-full-screen', () => setImmediate(mode));
    current.on('leave-full-screen', () => setImmediate(mode));
    current.on('resize', notify);
    const operatorMove = (_event, bounds) => {
      if (win === current && placed && placing === null && current.isFocused() &&
          screen.getAllDisplays().some(d => d.id === targetId)) {
        targetId = screen.getDisplayMatching(bounds).id;
        ++revision;
      }
    };
    current.on('will-move', operatorMove);
    current.on('move', () => {
      // On macOS/Windows only focused will-move changes routing intent. Native
      // background Spaces relocation must not reroute the next grid reflow.
      if (platform === 'linux') operatorMove(null, current.getBounds());
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
    const prev = TimerTools.outputState(previous, 'secondary') || {};
    if (!!s.transparent !== transparent) {
      const id = targetId;
      close(); open(id); return;
    }
    win.setAlwaysOnTop(!!s.transparent || !!s.gridOn, 'floating');
    win.webContents.send('state', s);
    if (!!prev.gridOn !== !!s.gridOn || (s.gridOn &&
        (prev.gridSize !== s.gridSize || prev.gridCell !== s.gridCell))) {
      const target = screen.getAllDisplays().find(d => d.id === targetId);
      if (target) position(target);
    }
  }
  async function resize(requested) {
    const size = TimerTools.size(requested);
    if (!enabled() || !size) return { ok: false };
    if (!win || win.isDestroyed()) {
      if (!open(requested.displayId).ok) return { ok: false };
    }
    const current = win;
    if (!ready) {
      const loaded = await new Promise(resolve => {
        const finish = value => {
          current.removeListener('ready-to-show', onReady);
          current.removeListener('closed', onClosed);
          resolve(value);
        };
        const onReady = () => finish(true), onClosed = () => finish(false);
        current.once('ready-to-show', onReady);
        current.once('closed', onClosed);
      });
      if (!loaded) return { ok: false };
    }
    if (win !== current || current.isDestroyed()) return { ok: false };
    const version = ++revision;
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
  function displayMetricsChanged(display, metrics) {
    if (placed) OutputQuality.reflowGridForDisplay({ win, display, metrics, state: state(), targetId,
      placing: placing !== null, beforeMove: () => { ++revision; } });
    notify();
  }
  return { open, close, update, resize, geometry, displaysChanged, displayMetricsChanged, getWindow: () => win, getRevision: () => revision,
    settled: () => ready && placed && placing === null,
    toggleFullscreen() {
      if (win && !win.isDestroyed()) { const entering=!isFullscreen(win); if(!win.isSimpleFullScreen?.())protectSibling(win, entering); setPresentationFullscreen(win, entering, false, platform); mode(); }
    } };
};
