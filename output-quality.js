const TimerTools = require('./timer-tools');

const MAX_CAPTURE_PIXELS = 16 * 1024 * 1024;
// This fixed script observes layout only. It never reads timer text, URLs or
// application state, and never changes styles, zoom, playback or window state.
const MEASURE_RENDERER = `(async () => {
  const bounded = (promise, ms) => new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    Promise.resolve(promise).then(() => { clearTimeout(timer); resolve(); }, () => { clearTimeout(timer); resolve(); });
  });
  if (document.fonts) await bounded(document.fonts.ready, 750);
  await bounded(new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))), 250);
  const width = innerWidth, height = innerHeight;
  const visible = el => {
    if (!el) return false;
    for (let item = el; item; item = item.parentElement) {
      const style = getComputedStyle(item);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  let clipped = false;
  if (!visible(document.getElementById('blackout')) && !visible(document.getElementById('audienceQr'))) {
    clipped = ['timer', 'secondaryTimer', 'text', 'msg'].some(id => {
      const el = document.getElementById(id);
      if (!visible(el)) return false;
      const rect = el.getBoundingClientRect(), pane = el.closest('.timer-pane');
      const limit = pane ? pane.getBoundingClientRect() : {left:0,top:0,right:width,bottom:height};
      return rect.left < Math.max(0, limit.left) - 1 || rect.top < Math.max(0, limit.top) - 1 ||
        rect.right > Math.min(width, limit.right) + 1 || rect.bottom > Math.min(height, limit.bottom) + 1;
    });
  }
  return {width, height, devicePixelRatio, clipped};
})()`;

const positive = (value, fallback = 1) => Number.isFinite(value) && value > 0 ? value : fallback;
function displayInfo(display, index = 0) {
  const scaleFactor = positive(display.scaleFactor);
  const width = display.bounds.width, height = display.bounds.height;
  return {
    displayId: display.id, displayLabel: display.label || `Monitor ${index + 1}`,
    displayWidth: width, displayHeight: height, scaleFactor,
    refreshRate: positive(display.displayFrequency, null),
    // OS raster estimates, not the HDMI signal or a panel's native resolution.
    pixelWidth: Math.round(width * scaleFactor), pixelHeight: Math.round(height * scaleFactor)
  };
}
function outputGeometry(win, screen) {
  if (!win || win.isDestroyed()) return null;
  const display = screen.getDisplayMatching(win.getBounds());
  const info = displayInfo(display, Math.max(0, screen.getAllDisplays().findIndex(d => d.id === display.id)));
  const [width, height] = win.getContentSize();
  return { ...info, width, height, fullscreen: win.isFullScreen(),
    pixelWidth: Math.round(width * info.scaleFactor), pixelHeight: Math.round(height * info.scaleFactor),
    zoomFactor: positive(win.webContents.getZoomFactor?.()) };
}

function gridBounds(display, state) {
  const grid = TimerTools.grid(state), b = display.bounds;
  const width = Math.floor(b.width / grid.gridSize), height = Math.floor(b.height / grid.gridSize);
  return { x: b.x + (grid.gridCell % grid.gridSize) * width,
    y: b.y + Math.floor(grid.gridCell / grid.gridSize) * height, width, height };
}
function reflowGridForDisplay({ win, display, metrics, state, targetId, placing, beforeMove }) {
  if (!win || win.isDestroyed() || win.isFullScreen() || placing || !state?.gridOn || targetId !== display.id ||
      !metrics.some(metric => ['bounds', 'scaleFactor', 'rotation', 'workArea'].includes(metric))) return false;
  const bounds = gridBounds(display, state), old = win.getBounds();
  if (Object.keys(bounds).every(key => old[key] === bounds[key])) return false;
  beforeMove?.();
  // Never use the explicit routing path here: OS metrics must not leave native
  // fullscreen, show hidden windows, or alter a manually sized output.
  win.setBounds(bounds);
  return true;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
function pngDimensions(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 24 ||
      !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      bytes.toString('ascii', 12, 16) !== 'IHDR') return null;
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}
function validRenderer(value) {
  return !!value && Number.isInteger(value.width) && value.width > 0 && Number.isInteger(value.height) && value.height > 0 &&
    Number.isFinite(value.devicePixelRatio) && value.devicePixelRatio > 0 && typeof value.clipped === 'boolean';
}
function createQualityReader({ screen, getWindow, getRevision, timeoutMs = 2000, maxCapturePixels = MAX_CAPTURE_PIXELS }) {
  const pendingCaptures = new WeakMap();
  return async function getOutputQuality(role = 'primary') {
    if (role !== 'primary' && role !== 'secondary') return { ok: false, code: 'INVALID_ROLE' };
    const win = getWindow(role);
    if (!win || win.isDestroyed()) return { ok: false, code: 'OUTPUT_CLOSED' };
    const revision = getRevision(role), geometry = outputGeometry(win, screen);
    let changed = false;
    const markChanged = () => { changed = true; };
    const events = ['move', 'resize', 'enter-full-screen', 'leave-full-screen'];
    events.forEach(event => win.on(event, markChanged));
    win.webContents.on('zoom-changed', markChanged);
    const stale = () => {
      const current = getWindow(role);
      if (!current || current.isDestroyed()) return { ok: false, code: 'OUTPUT_CLOSED' };
      if (current !== win || win.isDestroyed() || changed || getRevision(role) !== revision ||
          JSON.stringify(outputGeometry(win, screen)) !== JSON.stringify(geometry)) return { ok: false, code: 'OUTPUT_CHANGED' };
      return null;
    };
    try {
      const measured = await withTimeout(win.webContents.executeJavaScript(MEASURE_RENDERER), timeoutMs);
      if (stale()) return stale();
      if (!validRenderer(measured)) return { ok: false, code: 'OUTPUT_UNAVAILABLE' };
      let capture = null, captureStatus = 'unavailable';
      const pixelCount = Math.max(geometry.pixelWidth * geometry.pixelHeight,
        Math.ceil(measured.width * measured.devicePixelRatio) * Math.ceil(measured.height * measured.devicePixelRatio));
      if (pixelCount > maxCapturePixels) captureStatus = 'too-large';
      else if (!pendingCaptures.has(win)) {
        // A timed-out Electron capture cannot be cancelled. Keep it registered
        // until it settles so repeated checks cannot queue more large captures.
        const pending = Promise.resolve().then(() => win.webContents.capturePage());
        pendingCaptures.set(win, pending);
        pending.then(() => pendingCaptures.delete(win), () => pendingCaptures.delete(win));
        try {
          const image = await withTimeout(pending, timeoutMs);
          if (stale()) return stale();
          const scales = image.getScaleFactors?.() || [1];
          const scaleFactor = Math.max(1, ...scales.filter(value => Number.isFinite(value) && value > 0));
          // PNG IHDR gives encoded physical pixels; NativeImage.getSize() can
          // otherwise describe a logical size at a particular representation.
          capture = pngDimensions(image.toPNG({ scaleFactor }));
          if (capture) captureStatus = 'verified';
        } catch (_) { /* Dimensions remain useful when capture is unavailable. */ }
      }
      if (stale()) return stale();
      const after = await withTimeout(win.webContents.executeJavaScript(MEASURE_RENDERER), timeoutMs);
      if (stale()) return stale();
      if (!validRenderer(after) || after.width !== measured.width || after.height !== measured.height ||
          after.devicePixelRatio !== measured.devicePixelRatio) return { ok: false, code: 'OUTPUT_CHANGED' };
      return { ok: true, role, geometry,
        renderer: { width: after.width, height: after.height, devicePixelRatio: after.devicePixelRatio, zoomFactor: geometry.zoomFactor },
        capture, captureStatus, clipped: after.clipped };
    } catch (_) {
      return stale() || { ok: false, code: 'OUTPUT_UNAVAILABLE' };
    } finally {
      events.forEach(event => win.removeListener(event, markChanged));
      win.webContents.removeListener('zoom-changed', markChanged);
    }
  };
}

module.exports = { MAX_CAPTURE_PIXELS, MEASURE_RENDERER, displayInfo, outputGeometry, gridBounds, reflowGridForDisplay, pngDimensions, createQualityReader };
