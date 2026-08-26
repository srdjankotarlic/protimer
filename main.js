const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const SMOKE = process.argv.includes('--smoke');
// token za daljinske komande (/cmd) — samo onaj ko ima ?t=token u linku može da kontroliše
const CMD_TOKEN = crypto.randomBytes(16).toString('hex');
const SERVER_INSTANCE = crypto.randomBytes(16).toString('hex');
// komande koje /cmd prihvata (isti skup koji kontroler ume da primeni)
const CMD_TYPES = ['start', 'reset', 'adjust', 'go', 'blackout', 'setDuration', 'mode', 'message', 'clearMessage', 'text', 'clearText', 'textOnly'];

let controlWin = null;
let outputWin = null;
let lastState = null;
let outputTransparent = false;   // da li je trenutni Ekran prozor providan
let outputFrameless = false;     // da li je bez okvira (providan ili grid)
let outputTargetId = null;       // na kom monitoru je Ekran

// ---------------- MREŽNI IZLAZ (OBS Browser Source / NDI most / confidence monitor) ----------------
let server = null;
let serverPort = 0;
const sseClients = new Set();
const pollWaiters = new Set();
const MAX_STREAM_CLIENTS = 150;
let stateVersion = 0;

function wireState(state) {
  return state ? { ...state, _serverNow: Date.now(), _version: stateVersion, _instance: SERVER_INSTANCE } : null;
}

function finishPoll(waiter, state) {
  if (!pollWaiters.has(waiter)) return;
  pollWaiters.delete(waiter);
  clearTimeout(waiter.timer);
  try { waiter.res.end(JSON.stringify({ version: stateVersion, state: wireState(state), serverNow: Date.now() })); }
  catch (e) {}
}

function pushPoll(state) {
  for (const waiter of [...pollWaiters]) finishPoll(waiter, state);
}

function lanIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name]) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return '127.0.0.1';
}

function startServer(port, attempt = 0) {
  const outputHtml = () => {
    try { return fs.readFileSync(path.join(__dirname, 'output.html'), 'utf8'); }
    catch (e) { return '<h1>ProTimer</h1>'; }
  };

  const fileHtml = (name) => {
    try { return fs.readFileSync(path.join(__dirname, name), 'utf8'); }
    catch (e) { return '<h1>ProTimer</h1>'; }
  };

  server = http.createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];

    if (url === '/' || url === '/output.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(outputHtml());
      return;
    }

    if (url === '/remote') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(fileHtml('remote.html'));
      return;
    }

    if (url === '/backstage') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(fileHtml('backstage.html'));
      return;
    }

    // Kratak RTT endpoint: browseri koriste sat host računara umesto sata telefona.
    if (url === '/time') {
      const body = JSON.stringify({ now: Date.now(), instance: SERVER_INSTANCE });
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Content-Length': Buffer.byteLength(body)
      });
      res.end(body);
      return;
    }

    // Provera da tunnel ne baferuje završene odgovore (SSE nije uslov za javni viewer).
    if (url === '/transport-probe') {
      const qs = new URLSearchParams((req.url || '').split('?')[1] || '');
      if (qs.get('instance') !== SERVER_INSTANCE) {
        res.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end('{"ok":false}');
        return;
      }
      setTimeout(() => {
        if (res.destroyed) return;
        const body = JSON.stringify({ ok: true, instance: SERVER_INSTANCE });
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate, no-transform',
          'X-Accel-Buffering': 'no',
          'Content-Length': Buffer.byteLength(body)
        });
        res.end(body);
      }, 250);
      return;
    }

    // HTTPS tuneli ponekad baferuju SSE. Long-poll završava HTTP odgovor na svaku promenu,
    // pa javni viewer dobija pouzdan rezervni kanal bez stalnog agresivnog polling-a.
    if (url === '/poll') {
      const qs = new URLSearchParams((req.url || '').split('?')[1] || '');
      const sinceValue = qs.get('since');
      const since = sinceValue === null ? NaN : Number(sinceValue);
      const pollHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, no-transform',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no'
      };
      if (!Number.isFinite(since) || since !== stateVersion) {
        res.writeHead(200, pollHeaders);
        res.end(JSON.stringify({ version: stateVersion, state: wireState(lastState), serverNow: Date.now() }));
        return;
      }
      if (pollWaiters.size + sseClients.size >= MAX_STREAM_CLIENTS) {
        res.writeHead(503, { ...pollHeaders, 'Retry-After': '1' });
        res.end('{"error":"too many viewers"}');
        return;
      }
      res.writeHead(200, pollHeaders);
      const waiter = { res, timer: null };
      pollWaiters.add(waiter);
      waiter.timer = setTimeout(() => finishPoll(waiter, null), 20000);
      const cleanup = () => { if (pollWaiters.delete(waiter)) clearTimeout(waiter.timer); };
      req.on('aborted', cleanup);
      res.on('close', cleanup);
      res.on('error', cleanup);
      return;
    }

    // komande sa daljinskog (telefon/tablet) i HTTP API (Stream Deck / Companion / cURL)
    // POST /cmd {type,value} ili GET /cmd?type=start&value=…&t=TOKEN
    if (url === '/cmd' && (req.method === 'POST' || req.method === 'GET')) {
      // token: samo onaj ko ima ispravan ?t= / x-pt-token sme da kontroliše
      const qs = new URLSearchParams(req.url.split('?')[1] || '');
      const token = req.headers['x-pt-token'] || qs.get('t');
      if (token !== CMD_TOKEN) {
        res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end('{"ok":false,"error":"unauthorized"}');
        return;
      }
      const dispatch = (cmd) => {
        const ok = cmd && CMD_TYPES.includes(cmd.type);
        if (ok && controlWin && !controlWin.isDestroyed()) controlWin.webContents.send('remote-cmd', cmd);
        res.writeHead(ok ? 200 : 400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(ok ? '{"ok":true}' : '{"ok":false,"error":"unknown type"}');
      };
      if (req.method === 'GET') {
        const v = qs.get('value');
        dispatch({ type: qs.get('type'), value: v === null ? undefined : (/^-?\d+$/.test(v) ? +v : v) });
        return;
      }
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
      req.on('end', () => {
        let cmd = null;
        try { cmd = JSON.parse(body || '{}'); } catch (e) {}
        dispatch(cmd);
      });
      return;
    }

    if (url === '/events') {
      if (sseClients.size + pollWaiters.size >= MAX_STREAM_CLIENTS) {
        res.writeHead(503, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store', 'Retry-After': '1' });
        res.end('Too many viewers');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*'
      });
      if (res.flushHeaders) res.flushHeaders();
      if (req.socket && req.socket.setNoDelay) req.socket.setNoDelay(true);
      res.write('retry: 1000\n\n');
      if (lastState) res.write('data: ' + JSON.stringify(wireState(lastState)) + '\n\n');
      sseClients.add(res);
      const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 15000);
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        clearInterval(ping);
        sseClients.delete(res);
      };
      req.on('close', cleanup);
      res.on('error', cleanup);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < 10) {
      startServer(port + 1, attempt + 1);
    } else {
      console.error('Server error:', err.message);
    }
  });

  server.headersTimeout = 10000;
  server.requestTimeout = 30000;

  server.listen(port, '0.0.0.0', () => {
    serverPort = port;
    pushNetworkInfo();
  });
}

function pushSSE(state) {
  const data = 'data: ' + JSON.stringify(wireState(state)) + '\n\n';
  for (const res of sseClients) { try { res.write(data); } catch (e) { sseClients.delete(res); } }
}

// ---------------- OSC ULAZ (QLab / Companion / TouchOSC / bilo koji OSC sender) ----------------
// UDP, adrese /protimer/<type> — isti skup komandi kao HTTP API. LAN-poverenje kao kod
// Ontime/QLab: OSC nema token (dokumentovano u SECURITY.md).
let oscSocket = null, oscPort = 0;
function parseOSC(buf) {
  // OSC 1.0: address (null-terminisan string, 4-byte poravnat), ',tipovi', argumenti
  const readStr = (off) => {
    const end = buf.indexOf(0, off);
    if (end < 0) return null;
    return { str: buf.toString('ascii', off, end), next: (end + 4) & ~3 };
  };
  const a = readStr(0);
  if (!a || a.str[0] !== '/') return null;
  let args = [], off = a.next;
  const t = readStr(off);
  if (t && t.str[0] === ',') {
    off = t.next;
    for (const tag of t.str.slice(1)) {
      if (tag === 'i') { args.push(buf.readInt32BE(off)); off += 4; }
      else if (tag === 'f') { args.push(Math.round(buf.readFloatBE(off))); off += 4; }
      else if (tag === 's') { const s = readStr(off); if (!s) break; args.push(s.str); off = s.next; }
      else break; // nepodržan tag (blob/…) — stani
    }
  }
  return { address: a.str, args };
}
function startOSC(port, attempt = 0) {
  const dgram = require('dgram');
  oscSocket = dgram.createSocket('udp4');
  oscSocket.on('error', (err) => {
    try { oscSocket.close(); } catch (e) {}
    if (err.code === 'EADDRINUSE' && attempt < 10) startOSC(port + 1, attempt + 1);
    else console.error('OSC error:', err.message);
  });
  oscSocket.on('message', (buf) => {
    try {
      const m = parseOSC(buf);
      if (!m) return;
      const type = m.address.replace(/^\/protimer\//, '');
      if (!CMD_TYPES.includes(type)) return;
      const cmd = { type, value: m.args.length ? m.args[0] : undefined };
      if (controlWin && !controlWin.isDestroyed()) controlWin.webContents.send('remote-cmd', cmd);
    } catch (e) {}
  });
  oscSocket.bind(port, '0.0.0.0', () => { oscPort = port; pushNetworkInfo(); });
}

function networkInfo() {
  return { ip: lanIP(), port: serverPort, running: !!serverPort,
    clients: sseClients.size + pollWaiters.size, token: CMD_TOKEN, oscPort };
}
function pushNetworkInfo() {
  if (controlWin && !controlWin.isDestroyed()) controlWin.webContents.send('network-info', networkInfo());
}
setInterval(pushNetworkInfo, 3000);

// ---------------- PROZORI ----------------
function controlDisplayId() {
  if (!controlWin || controlWin.isDestroyed()) return screen.getPrimaryDisplay().id;
  return screen.getDisplayMatching(controlWin.getBounds()).id;
}
function outputDisplayId() {
  if (!outputWin || outputWin.isDestroyed()) return null;
  return screen.getDisplayMatching(outputWin.getBounds()).id;
}
function displayList() {
  const primaryId = screen.getPrimaryDisplay().id;
  const ctlId = controlDisplayId();
  const outId = outputDisplayId();
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id, label: d.label || `Monitor ${i + 1}`,
    width: d.bounds.width, height: d.bounds.height,
    primary: d.id === primaryId, hasControl: d.id === ctlId, hasOutput: d.id === outId
  }));
}
function broadcast(channel, payload) {
  [controlWin, outputWin].forEach(w => { if (w && !w.isDestroyed()) w.webContents.send(channel, payload); });
}
function pushDisplays() { broadcast('displays', displayList()); }
function pushOutputState() {
  if (controlWin && !controlWin.isDestroyed()) controlWin.webContents.send('output-state', !!outputWin);
}

function createControlWindow() {
  controlWin = new BrowserWindow({
    width: 1120, height: 740, minWidth: 820, minHeight: 480,
    title: 'ProTimer — Kontrola', backgroundColor: '#0b0d11',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  controlWin.loadFile('controller.html');
  controlWin.on('closed', () => {
    controlWin = null;
    if (outputWin && !outputWin.isDestroyed()) outputWin.destroy();
    app.quit();
  });
}

function positionOutput(target) {
  if (!outputWin || outputWin.isDestroyed()) return;
  outputTargetId = target.id;
  const ctlId = controlDisplayId();
  const g = lastState || {};
  if (g.gridOn && g.gridSize) {
    // GRID: prozor = izabrana kockica N×N tog monitora (mali timer-prozor)
    const n = g.gridSize, cell = Math.max(0, Math.min(n * n - 1, g.gridCell || 0));
    const r = Math.floor(cell / n), c = cell % n;
    const b = target.bounds;
    const cw = Math.floor(b.width / n), ch = Math.floor(b.height / n);
    if (outputWin.isFullScreen()) outputWin.setFullScreen(false);
    outputWin.setBounds({ x: b.x + c * cw, y: b.y + r * ch, width: cw, height: ch });
  } else if (target.id !== ctlId) {
    outputWin.setFullScreen(false);
    outputWin.setBounds(target.bounds);
    outputWin.setFullScreen(true);
  } else {
    if (outputWin.isFullScreen()) outputWin.setFullScreen(false);
    const b = target.workArea;
    const w = Math.min(900, Math.floor(b.width * 0.45));
    const h = Math.floor(w * 9 / 16);
    outputWin.setBounds({ x: b.x + b.width - w - 24, y: b.y + 48, width: w, height: h });
  }
  outputWin.show();
  pushDisplays();
}

function createOutputWindow(displayId) {
  const displays = screen.getAllDisplays();
  const target = displays.find(d => d.id === displayId)
    || displays.find(d => d.id !== controlDisplayId()) || displays[0];
  outputTargetId = target.id;

  if (outputWin && !outputWin.isDestroyed()) { positionOutput(target); return; }

  const transparent = !!(lastState && lastState.transparent);
  const grid = !!(lastState && lastState.gridOn);
  const frameless = transparent || grid;   // grid prozor je takođe bez okvira (čista kockica)
  outputTransparent = transparent;
  outputFrameless = frameless;

  outputWin = new BrowserWindow({
    width: 900, height: 506, minWidth: 80, minHeight: 60, show: false,
    title: 'ProTimer — Ekran',
    backgroundColor: transparent ? '#00000000' : '#000000',
    transparent: transparent,
    frame: !frameless,
    hasShadow: !frameless,
    alwaysOnTop: frameless,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  if (frameless) outputWin.setAlwaysOnTop(true, 'floating');
  outputWin.loadFile('output.html');
  if (SMOKE) outputWin.webContents.on('console-message', (e, l, m, ln) => console.log(`OUT_CONSOLE [${l}] ${m} (line ${ln})`));
  outputWin.webContents.on('did-finish-load', () => {
    if (lastState) outputWin.webContents.send('state', lastState);
    pushDisplays(); pushOutMode();
  });
  outputWin.on('enter-full-screen', pushOutMode);
  outputWin.on('leave-full-screen', pushOutMode);
  outputWin.once('ready-to-show', () => positionOutput(target));
  outputWin.on('closed', () => { outputWin = null; pushOutputState(); pushDisplays(); });
  pushOutputState();
}

// javi izlazu da li je u punom ekranu (da odluči: grid vs kompaktan prozor)
function pushOutMode() {
  if (outputWin && !outputWin.isDestroyed()) outputWin.webContents.send('win-fs', outputWin.isFullScreen());
}

// Electron ne može da uključi/isključi `transparent` naživo → presozdaj prozor
// na istom monitoru (createOutputWindow ga sam pozicionira/fullscreen-uje)
function recreateOutputForTransparency() {
  if (!outputWin || outputWin.isDestroyed()) return;
  const id = outputTargetId;
  outputWin.destroy();
  outputWin = null;
  createOutputWindow(id);
}

// ---------------- IPC ----------------
ipcMain.on('state', (e, s) => {
  const prev = lastState || {};
  const gridPosChanged = (prev.gridSize !== s.gridSize) || (prev.gridCell !== s.gridCell);
  const wantFrameless = !!s.transparent || !!s.gridOn;
  lastState = s;
  stateVersion++;
  if (outputWin && !outputWin.isDestroyed()) {
    if (!!s.transparent !== outputTransparent || wantFrameless !== outputFrameless) {
      recreateOutputForTransparency();   // providnost ili okvir (grid uklj/isklj) → novi prozor (sam se pozicionira)
    } else {
      outputWin.webContents.send('state', s);
      if (gridPosChanged && s.gridOn) {   // druga kockica / veličina grida → presloži prozor
        const d = screen.getAllDisplays().find(x => x.id === outputTargetId) || screen.getPrimaryDisplay();
        positionOutput(d);
      }
    }
  }
  pushSSE(s);
  pushPoll(s);
});
ipcMain.on('open-output', (e, displayId) => createOutputWindow(displayId || null));
ipcMain.on('send-to-display', (e, displayId) => {
  const d = screen.getAllDisplays().find(x => x.id === displayId);
  if (!outputWin || outputWin.isDestroyed()) { createOutputWindow(d ? d.id : null); return; }
  if (d) positionOutput(d);
});
ipcMain.on('close-output', () => { if (outputWin && !outputWin.isDestroyed()) outputWin.close(); });
ipcMain.on('toggle-fullscreen', () => { if (outputWin && !outputWin.isDestroyed()) outputWin.setFullScreen(!outputWin.isFullScreen()); });
ipcMain.on('exit-fullscreen', () => { if (outputWin && !outputWin.isDestroyed()) outputWin.setFullScreen(false); });
// kompaktan prozor: izlaz traži da visina prozora prati visinu tajmera (samo kad NIJE fullscreen)
ipcMain.on('fit-window', (e, h) => {
  if (!outputWin || outputWin.isDestroyed() || outputWin.isFullScreen()) return;
  const want = Math.max(80, Math.min(Math.round(h) || 0, 2200));
  const [w, cur] = outputWin.getContentSize();
  if (Math.abs(cur - want) > 4) outputWin.setContentSize(w, want);
});
ipcMain.on('ctl-on-top', (e, flag) => { if (controlWin && !controlWin.isDestroyed()) controlWin.setAlwaysOnTop(!!flag, 'floating'); });
ipcMain.handle('displays', () => displayList());
ipcMain.handle('output-open', () => !!outputWin);
ipcMain.handle('network-info', () => networkInfo());

// ---------------- QR KOD + JAVNI LINK (tunel) ----------------
let tunnel = null, tunnelUrl = null, tunnelStarting = false, tunnelProvider = null;
let tunnelStartPromise = null, tunnelGeneration = 0, pendingTunnelProcess = null;

ipcMain.handle('qr', async (e, text) => {
  try {
    const QRCode = require('qrcode');
    return await QRCode.toString(String(text || ''), {
      type: 'svg', margin: 1, color: { dark: '#0b0d11', light: '#ffffff' }
    });
  } catch (err) { return null; }
});

function pushShare() {
  if (controlWin && !controlWin.isDestroyed())
    controlWin.webContents.send('share-info', { url: tunnelUrl, starting: tunnelStarting, provider: tunnelProvider });
}

function executableFile(file) {
  try {
    if (!file || !fs.statSync(file).isFile()) return false;
    if (process.platform !== 'win32') fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch (e) { return false; }
}

function bundledCloudflared() {
  const name = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  if (app.isPackaged) {
    const bundled = path.join(process.resourcesPath, name);
    return executableFile(bundled) ? bundled : null;
  }
  const candidates = [path.join(__dirname, 'vendor',
    process.platform === 'win32' ? 'cloudflared-windows-amd64.exe' : 'cloudflared-darwin-arm64')];
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (dir) candidates.push(path.join(dir, name));
  }
  if (process.platform === 'darwin') candidates.push('/opt/homebrew/bin/cloudflared', '/usr/local/bin/cloudflared');
  return candidates.find(executableFile) || null;
}

// Cloudflare Quick Tunnel: bez naloga, nasumičan HTTPS URL. Release paketi nose zvanični,
// potpisani cloudflared binarni fajl; source build koristi lokalnu instalaciju ako postoji.
function startCloudflareTunnel(timeoutMs = 18000) {
  const binary = bundledCloudflared();
  if (!binary) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false, timer = null, output = '', configDir = null;
    let issuedUrl = null, connectionRegistered = false;
    let child = null, configCleaned = false;
    const cleanupConfig = () => {
      if (configCleaned) return;
      configCleaned = true;
      if (configDir) { try { fs.rmSync(configDir, { recursive: true, force: true }); } catch (e) {} }
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (pendingTunnelProcess === child) pendingTunnelProcess = null;
      try { if (child && child.close) child.close(); } catch (e) {}
      cleanupConfig();
      resolve(null);
    };
    try {
      configDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'protimer-cloudflared-'));
      const configPath = path.join(configDir, 'config.yml');
      fs.writeFileSync(configPath, 'loglevel: info\n', { mode: 0o600, flag: 'wx' });
      const childEnv = { ...process.env };
      for (const key of Object.keys(childEnv)) {
        if (/^TUNNEL_/i.test(key) || key === 'NO_TLS_VERIFY') delete childEnv[key];
      }
      child = spawn(binary, [
        'tunnel', '--config', configPath, '--url', `http://127.0.0.1:${serverPort}`,
        '--no-autoupdate', '--loglevel', 'info'
      ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, env: childEnv });
      child.close = () => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        try { child.kill(); } catch (e) {}
        const killTimer = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) { try { child.kill('SIGKILL'); } catch (e) {} }
        }, 1500);
        if (killTimer.unref) killTimer.unref();
      };
      pendingTunnelProcess = child;
    } catch (e) { fail(); return; }
    const inspect = (chunk) => {
      output = (output + String(chunk || '')).slice(-16000);
      const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i);
      if (match) issuedUrl = match[0];
      if (/Registered tunnel connection/i.test(output)) connectionRegistered = true;
      // cloudflared objavi URL pre nego što edge veza i DNS ruta budu spremni. Čekanje na
      // registraciju sprečava prerani ENOTFOUND da ostane u Electron-ovom DNS cache-u.
      if (!issuedUrl || !connectionRegistered || settled) return;
      settled = true;
      clearTimeout(timer);
      if (pendingTunnelProcess === child) pendingTunnelProcess = null;
      child.url = issuedUrl;
      child.provider = 'cloudflare';
      resolve(child);
    };
    child.stdout.on('data', inspect);
    child.stderr.on('data', inspect);
    child.once('error', fail);
    child.once('close', () => { cleanupConfig(); if (!settled) fail(); });
    timer = setTimeout(fail, Math.max(1000, timeoutMs));
  });
}

async function startLocalTunnel(timeoutMs = 15000) {
  const localtunnel = require('localtunnel');
  return await new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { settled = true; reject(new Error('fallback tunnel timeout')); }, Math.max(1000, timeoutMs));
    localtunnel({ port: serverPort }).then((fallback) => {
      if (settled) { closeTunnel(fallback); return; }
      settled = true; clearTimeout(timer);
      fallback.provider = 'localtunnel'; resolve(fallback);
    }).catch((error) => {
      if (settled) return;
      settled = true; clearTimeout(timer); reject(error);
    });
  });
}

function validTunnelURL(candidate) {
  try {
    const u = new URL(candidate && candidate.url);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.pathname !== '/' || u.search || u.hash) return false;
    if (candidate.provider === 'cloudflare') return /^[a-z0-9-]+\.trycloudflare\.com$/i.test(u.hostname);
    if (candidate.provider === 'localtunnel') return /^[a-z0-9-]+\.loca\.lt$/i.test(u.hostname);
  } catch (e) {}
  return false;
}

function tunnelTimeOK(baseUrl, timeoutMs = 3500) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    try {
      const u = new URL('/time', baseUrl);
      const transport = u.protocol === 'https:' ? https : http;
      const req = transport.get(u, {
        headers: {
          'User-Agent': 'ProTimer tunnel check',
          'bypass-tunnel-reminder': 'true'
        }
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; if (body.length > 4096) req.destroy(); });
        res.on('end', () => {
          let value = null;
          try { value = JSON.parse(body); } catch (e) {}
          const ok = res.statusCode === 200 && value && value.instance === SERVER_INSTANCE && Number.isFinite(value.now)
            && Math.abs(Date.now() - value.now) < 60000;
          if (!ok) console.warn(`[share] /time probe failed (HTTP ${res.statusCode || 0})`);
          done(ok);
        });
      });
      req.setTimeout(timeoutMs, () => { console.warn('[share] /time probe timed out'); req.destroy(); done(false); });
      req.on('error', (error) => { console.warn(`[share] /time probe error: ${error.code || error.message}`); done(false); });
    } catch (e) { done(false); }
  });
}

function tunnelTransportOK(baseUrl, timeoutMs = 3500) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => { if (!settled) { settled = true; resolve(ok); } };
    try {
      const u = new URL(`/transport-probe?instance=${encodeURIComponent(SERVER_INSTANCE)}`, baseUrl);
      const req = https.get(u, {
        headers: { 'User-Agent': 'ProTimer tunnel check', 'bypass-tunnel-reminder': 'true', 'Cache-Control': 'no-cache' }
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; if (body.length > 4096) req.destroy(); });
        res.on('end', () => {
          let value = null; try { value = JSON.parse(body); } catch (e) {}
          const ok = res.statusCode === 200 && value && value.ok === true && value.instance === SERVER_INSTANCE;
          if (!ok) console.warn(`[share] transport probe failed (HTTP ${res.statusCode || 0})`);
          done(ok);
        });
      });
      req.setTimeout(timeoutMs, () => { console.warn('[share] transport probe timed out'); req.destroy(); done(false); });
      req.on('error', (error) => { console.warn(`[share] transport probe error: ${error.code || error.message}`); done(false); });
    } catch (e) { done(false); }
  });
}

async function waitForTunnel(baseUrl, totalMs = 18000) {
  // URL se odštampa malo pre nego što je nova edge ruta svuda spremna.
  const deadline = Date.now() + Math.max(1000, totalMs);
  await new Promise(resolve => setTimeout(resolve, Math.min(1500, Math.max(0, deadline - Date.now()))));
  for (let attempt = 0; attempt < 6 && Date.now() < deadline; attempt++) {
    let remaining = deadline - Date.now();
    if (remaining < 300) break;
    const timeOK = await tunnelTimeOK(baseUrl, Math.min(4000, remaining));
    remaining = deadline - Date.now();
    if (timeOK && remaining >= 300 && await tunnelTransportOK(baseUrl, Math.min(4000, remaining))) return true;
    remaining = deadline - Date.now();
    if (attempt < 5 && remaining > 0)
      await new Promise(resolve => setTimeout(resolve, Math.min(1000, remaining)));
  }
  return false;
}

function closeTunnel(candidate) {
  try { if (candidate && candidate.close) candidate.close(); } catch (e) {}
}

function observeTunnel(candidate, generation) {
  const failed = () => {
    if (generation !== tunnelGeneration || tunnel !== candidate) return;
    tunnelGeneration++;
    tunnel = null; tunnelUrl = null; tunnelProvider = null; tunnelStarting = false;
    pushShare();
  };
  candidate.on('close', failed);
  candidate.on('error', () => { closeTunnel(candidate); failed(); });
}

async function activateTunnel(candidate, generation, deadline) {
  if (!candidate || generation !== tunnelGeneration || !validTunnelURL(candidate)) {
    closeTunnel(candidate);
    return null;
  }
  tunnel = candidate;
  tunnelProvider = candidate.provider;
  const remaining = Math.max(0, deadline - Date.now());
  const healthy = remaining >= 1000 && await waitForTunnel(candidate.url, Math.min(18000, remaining));
  if (generation !== tunnelGeneration || tunnel !== candidate) {
    closeTunnel(candidate);
    return null;
  }
  if (!healthy) {
    tunnel = null; tunnelProvider = null;
    closeTunnel(candidate);
    return null;
  }
  observeTunnel(candidate, generation);
  return candidate;
}

async function beginShare() {
  const generation = ++tunnelGeneration;
  const deadline = Date.now() + 60000;
  tunnelStarting = true; pushShare();
  try {
    let candidate = null;
    // Quick Tunnel ruta ponekad ostane neupotrebljiva iako je URL već izdat.
    // Probaj još jednu potpuno novu Cloudflare rutu pre sporijeg fallback provajdera.
    for (let attempt = 0; attempt < 2 && !candidate; attempt++) {
      if (generation !== tunnelGeneration) return { error: 'cancelled' };
      const remaining = deadline - Date.now();
      if (remaining < 1000) break;
      candidate = await startCloudflareTunnel(Math.min(18000, remaining));
      if (generation !== tunnelGeneration) { closeTunnel(candidate); return { error: 'cancelled' }; }
      candidate = await activateTunnel(candidate, generation, deadline);
    }
    if (!candidate && generation === tunnelGeneration && deadline - Date.now() >= 1000) {
      const fallback = await startLocalTunnel(Math.min(15000, deadline - Date.now()));
      if (generation !== tunnelGeneration) { closeTunnel(fallback); return { error: 'cancelled' }; }
      candidate = await activateTunnel(fallback, generation, deadline);
    }
    if (!candidate || generation !== tunnelGeneration || tunnel !== candidate) throw new Error('public link unavailable');
    tunnelUrl = candidate.url;
    tunnelStarting = false; pushShare();
    return { url: tunnelUrl, provider: tunnelProvider };
  } catch (err) {
    if (generation === tunnelGeneration) {
      closeTunnel(tunnel);
      tunnel = null; tunnelUrl = null; tunnelProvider = null; tunnelStarting = false; pushShare();
    }
    return { error: (err && err.message) || 'fail' };
  }
}

ipcMain.handle('share-start', () => {
  if (tunnel && tunnelUrl) return { url: tunnelUrl, provider: tunnelProvider };
  if (tunnelStartPromise) return tunnelStartPromise;
  const pending = beginShare();
  tunnelStartPromise = pending;
  pending.then(() => { if (tunnelStartPromise === pending) tunnelStartPromise = null; },
    () => { if (tunnelStartPromise === pending) tunnelStartPromise = null; });
  return pending;
});
ipcMain.handle('share-stop', () => {
  tunnelGeneration++;
  const current = tunnel;
  if (pendingTunnelProcess) { closeTunnel(pendingTunnelProcess); pendingTunnelProcess = null; }
  tunnelStartPromise = null;
  tunnel = null; tunnelUrl = null; tunnelProvider = null; tunnelStarting = false; pushShare();
  closeTunnel(current);
  return true;
});
ipcMain.handle('share-info', () => ({ url: tunnelUrl, starting: tunnelStarting, provider: tunnelProvider }));
app.on('before-quit', () => {
  tunnelGeneration++;
  if (pendingTunnelProcess) { closeTunnel(pendingTunnelProcess); pendingTunnelProcess = null; }
  closeTunnel(tunnel);
  tunnel = null;
});

// ---------------- PROMO: snimanje demo kadrova izlaznog ekrana ----------------
function runPromo() {
  const demo = {
    mode:'countdown', running:false, durationMs:10000, remMs:10000, endAt:0, startAt:0, elapsedMs:0,
    yellowSec:5, redSec:2, overtime:true, useWarnColors:true, warnYellow:'#ffc23a', warnRed:'#ff4540', flashZero:true,
    bgColor:'#0b0d11', fgColor:'#ffffff', text:'', message:{ text:'', flash:false }, blackout:false,
    showProgress:true, transparent:false, lang:'en', showNowNext:true, currentCue:0,
    cues:[ { name:'Keynote — Dr. Maya Chen', durationMs:10000, note:'', color:'#3fb950' },
           { name:'Q&A Panel', durationMs:1200000, note:'', color:'#4493f8' } ]
  };
  const pw = new BrowserWindow({
    width:1280, height:720, show:true, frame:false, backgroundColor:'#0b0d11',
    webPreferences:{ preload: path.join(__dirname,'preload.js'), contextIsolation:true, nodeIntegration:false }
  });
  pw.loadFile('output.html');
  pw.webContents.on('did-finish-load', async () => {
    const dir='/tmp/promo';
    try { fs.rmSync(dir,{recursive:true,force:true}); } catch(e){}
    fs.mkdirSync(dir,{recursive:true});
    // potpuno sakrij overlay kontrole (#ui) za snimak — bulletproof
    await pw.webContents.executeJavaScript("var u=document.getElementById('ui'); if(u){u.style.display='none';} document.body.classList.add('idle');").catch(()=>{});
    await new Promise(r=>setTimeout(r,150));
    demo.running = true; demo.endAt = Date.now() + demo.durationMs;
    pw.webContents.send('state', demo);
    const total = 60, interval = 200;
    for (let i=0;i<total;i++){
      await new Promise(r=>setTimeout(r, interval));
      if (i===36){ demo.message = { text:'WRAP UP', flash:false }; pw.webContents.send('state', demo); }
      const img = await pw.webContents.capturePage();
      fs.writeFileSync(`${dir}/frame_${String(i).padStart(4,'0')}.png`, img.toPNG());
    }
    console.log('PROMO_DONE frames=' + total);
    app.exit(0);
  });
  setTimeout(()=>{ console.error('PROMO_TIMEOUT'); app.exit(1); }, 30000);
}

// ---------------- START ----------------
app.whenReady().then(() => {
  if (process.argv.includes('--promo')) { runPromo(); return; }
  if (process.argv.includes('--banner')) {
    const bw = new BrowserWindow({ width:1200, height:630, useContentSize:true, frame:false, show:false, webPreferences:{ contextIsolation:true } });
    bw.loadFile('build/banner.html');
    bw.webContents.on('did-finish-load', async () => {
      await new Promise(r=>setTimeout(r,400));
      fs.writeFileSync('/tmp/og-banner.png', (await bw.webContents.capturePage()).toPNG());
      console.log('BANNER_DONE'); app.exit(0);
    });
    setTimeout(()=>{ console.error('BANNER_TIMEOUT'); app.exit(1); }, 15000);
    return;
  }
  startServer(7878);
  startOSC(7879);
  createControlWindow();

  controlWin.webContents.once('did-finish-load', () => createOutputWindow(null));

  screen.on('display-added', (e, newDisplay) => {
    pushDisplays();
    if (outputWin && !outputWin.isDestroyed()) positionOutput(newDisplay);
  });
  screen.on('display-removed', () => {
    pushDisplays();
    if (outputWin && !outputWin.isDestroyed() && screen.getAllDisplays().length === 1)
      positionOutput(screen.getAllDisplays()[0]);
  });

  if (SMOKE) {
    const waitLoad = w => new Promise(res => {
      if (w && !w.webContents.isLoading()) return res();
      w.webContents.once('did-finish-load', res);
    });
    const waitOutput = () => new Promise(res => {
      const t = setInterval(() => { if (outputWin) { clearInterval(t); res(outputWin); } }, 50);
    });
    (async () => {
      try {
        const smokeFailures = [];
        const check = (name, ok) => { if (!ok) smokeFailures.push(name); return !!ok; };
        await waitLoad(controlWin);
        const ow = await waitOutput();
        await waitLoad(ow);
        // opcioni jezik + demo rundown za snimke: --ui-lang=en --demo
        const langArg = (process.argv.find(a => a.startsWith('--ui-lang=')) || '').split('=')[1];
        const demo = process.argv.includes('--demo');
        if (langArg || demo) {
          const now = new Date(); const hhmm = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
          const seed = demo ? `
            localStorage.setItem('pt_cues', JSON.stringify([
              {name:'Pre-show Countdown', durationMs:600000, note:'Music plays, holding slide', color:'#3fb950'},
              {name:'Welcome', durationMs:600000, note:'Emma Thompson', color:'#4493f8'},
              {name:'Session 1', durationMs:3000000, note:'Liam Carter, Sophia Patel', color:'#d9a441'},
              {name:'Lunch break', durationMs:3600000, note:'Lunch in the lobby', color:'#a371f7'}
            ]));
            var st=JSON.parse(localStorage.getItem('pt_settings')||'{}'); st.showStart='${hhmm}'; st.showNowNext=true; st.showProgress=true; localStorage.setItem('pt_settings', JSON.stringify(st));` : '';
          await controlWin.webContents.executeJavaScript(`localStorage.setItem('pt_lang','${langArg||'en'}'); ${seed} location.reload();`);
          await waitLoad(controlWin);
          if (demo) { await new Promise(r=>setTimeout(r,500)); await controlWin.webContents.executeJavaScript(`loadCue(0,false); startPause();`); }
        }
        await new Promise(r => setTimeout(r, 1800));
        fs.writeFileSync('/tmp/protimer_ctl.png', (await controlWin.webContents.capturePage()).toPNG());
        fs.writeFileSync('/tmp/protimer_out.png', (await ow.webContents.capturePage()).toPNG());
        // snimak backstage stranice (učita živi /backstage preko servera)
        if (demo) {
          const bw = new BrowserWindow({ width:1280, height:720, show:false, backgroundColor:'#0a0c10',
            webPreferences:{ contextIsolation:true } });
          await bw.loadURL(`http://127.0.0.1:${serverPort}/backstage`);
          await new Promise(r=>setTimeout(r,1600));
          fs.writeFileSync('/tmp/protimer_backstage.png', (await bw.webContents.capturePage()).toPNG());
          bw.destroy();
        }
        // test mrežnog izlaza: HTML stranica
        const got = await new Promise((resolve) => {
          http.get(`http://127.0.0.1:${serverPort}/`, r => {
            let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(d.includes('ProTimer')));
          }).on('error', () => resolve(false));
        });
        console.log('SERVER_OK=' + got + ' PORT=' + serverPort);
        check('SERVER_OK', got);
        const timeProbe = await new Promise((resolve) => {
          const started = Date.now();
          http.get(`http://127.0.0.1:${serverPort}/time`, res => {
            let body=''; res.on('data',c=>body+=c); res.on('end',()=>{
              let parsed=null; try { parsed=JSON.parse(body); } catch (e) {}
              const received=Date.now();
              resolve({ status:res.statusCode, now:parsed&&parsed.now, instance:parsed&&parsed.instance,
                offset:parsed&&parsed.now-(started+received)/2 });
            });
          }).on('error',()=>resolve({status:0,now:null,offset:null}));
        });
        const timeOK = timeProbe.status===200 && Number.isFinite(timeProbe.now)
          && timeProbe.instance===SERVER_INSTANCE && Math.abs(timeProbe.offset)<1000;
        console.log('TIME_SYNC_ENDPOINT_OK=' + timeOK + ` offset=${timeProbe.offset}`);
        check('TIME_SYNC_ENDPOINT_OK', timeOK);
        const transportProbe=await new Promise(resolve=>{
          const started=Date.now();
          http.get(`http://127.0.0.1:${serverPort}/transport-probe?instance=${SERVER_INSTANCE}`,res=>{
            let body='';res.on('data',c=>body+=c);res.on('end',()=>{
              let value=null;try{value=JSON.parse(body);}catch(e){}
              resolve({status:res.statusCode,ms:Date.now()-started,value});
            });
          }).on('error',()=>resolve({status:0,ms:9999,value:null}));
        });
        const badTransportStatus=await new Promise(resolve=>{
          http.get(`http://127.0.0.1:${serverPort}/transport-probe?instance=wrong`,res=>{res.resume();resolve(res.statusCode);})
            .on('error',()=>resolve(0));
        });
        const transportProbeOK=transportProbe.status===200&&transportProbe.value&&transportProbe.value.ok===true
          &&transportProbe.value.instance===SERVER_INSTANCE&&transportProbe.ms>=200&&transportProbe.ms<1500&&badTransportStatus===404;
        console.log('TRANSPORT_PROBE_OK='+transportProbeOK+` ms=${transportProbe.ms} bad=${badTransportStatus}`);
        check('TRANSPORT_PROBE_OK',transportProbeOK);
        // test SSE: da li /events isporučuje trenutno stanje (lanac kontroler→main→OBS)
        const readState = () => new Promise((resolve) => {
          const r = http.get(`http://127.0.0.1:${serverPort}/events`, res => {
            let buf = '';
            res.on('data', c => {
              buf += c;
              const m = buf.match(/data: (\{.*\})/);
              if (m) { r.destroy(); try { resolve(JSON.parse(m[1])); } catch (e) { resolve(null); } }
            });
          });
          r.on('error', () => resolve(null));
          setTimeout(() => { r.destroy(); resolve(null); }, 3000);
        });
        const probeSSE = () => new Promise((resolve) => {
          const started=Date.now();
          const r=http.get(`http://127.0.0.1:${serverPort}/events`,res=>{
            let buf='';
            res.on('data',c=>{
              buf+=c;
              const m=buf.match(/data: (\{.*\})/);
              if(m){
                r.destroy();
                let state=null; try{ state=JSON.parse(m[1]); }catch(e){}
                resolve({state,headers:res.headers,initialMs:Date.now()-started});
              }
            });
          });
          r.on('error',()=>resolve({state:null,headers:{},initialMs:9999}));
          setTimeout(()=>{r.destroy();resolve({state:null,headers:{},initialMs:9999});},3000);
        });
        const postCmd = (obj) => new Promise((resolve) => {
          const data = JSON.stringify(obj);
          const r = http.request(`http://127.0.0.1:${serverPort}/cmd`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'x-pt-token': CMD_TOKEN } },
            res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(d)); });
          r.on('error', () => resolve(null)); r.write(data); r.end();
        });
        const readPoll = (since, timeoutMs=3000) => new Promise((resolve) => {
          let settled=false, timer=null;
          const done=value=>{ if(settled)return; settled=true; clearTimeout(timer); resolve(value); };
          const r=http.get(`http://127.0.0.1:${serverPort}/poll?since=${encodeURIComponent(since)}`,res=>{
            let body=''; res.on('data',c=>body+=c); res.on('end',()=>{
              let value=null; try{ value=JSON.parse(body); }catch(e){}
              done(value);
            });
          });
          r.on('error',()=>done(null));
          timer=setTimeout(()=>{ r.destroy(); done(null); },timeoutMs);
        });
        const sseProbe = await probeSSE();
        const sse = sseProbe.state;
        const sseOK = !!(sse && sse.mode === 'countdown' && sse.durationMs > 0);
        const cacheHeader=String(sseProbe.headers['cache-control']||'');
        const sseHeadersOK = /text\/event-stream/.test(String(sseProbe.headers['content-type']||''))
          && cacheHeader.includes('no-transform') && sseProbe.headers['x-accel-buffering']==='no'
          && sseProbe.initialMs<1000;
        console.log('SSE_OK=' + sseOK + ' SSE_MODE=' + (sse && sse.mode));
        console.log('SSE_HEADERS_OK=' + sseHeadersOK + ` initialMs=${sseProbe.initialMs}`);
        check('SSE_OK', sseOK); check('SSE_HEADERS_OK', sseHeadersOK);

        // HTTPS fallback: zahtev mora ostati otvoren i završiti se čim se stanje promeni.
        const pollInitial=await readPoll(-1);
        const pollStarted=Date.now();
        const pollChangedPromise=readPoll(pollInitial&&pollInitial.version,3000);
        await new Promise(r=>setTimeout(r,100));
        await postCmd({ type: 'setDuration', value: 300000 });
        const pollChanged=await pollChangedPromise;
        const pollMs=Date.now()-pollStarted;
        const longPollOK=!!(pollInitial&&pollChanged&&pollChanged.version>pollInitial.version
          &&pollChanged.state&&pollChanged.state.durationMs===300000&&pollMs<2000);
        console.log('LONG_POLL_OK='+longPollOK+` ms=${pollMs} version=${pollInitial&&pollInitial.version}→${pollChanged&&pollChanged.version}`);
        check('LONG_POLL_OK',longPollOK);

        // test daljinskog: /remote stranica + POST komanda menja stanje
        const remotePage = await new Promise((resolve) => {
          http.get(`http://127.0.0.1:${serverPort}/remote`, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(d.includes('Daljinski'))); }).on('error',()=>resolve(false));
        });
        await new Promise(r => setTimeout(r, 400));
        const after = await readState();
        const remoteCmdOK=!!(after&&after.durationMs===300000);
        console.log('REMOTE_PAGE_OK=' + remotePage + ' REMOTE_CMD_OK=' + remoteCmdOK);
        check('REMOTE_PAGE_OK',remotePage); check('REMOTE_CMD_OK',remoteCmdOK);
        // bezbednost: /cmd BEZ tokena mora biti odbijen (403)
        const noTokStatus = await new Promise((resolve) => {
          const data = JSON.stringify({ type: 'reset' });
          const r = http.request(`http://127.0.0.1:${serverPort}/cmd`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, res => resolve(res.statusCode));
          r.on('error', () => resolve(0)); r.write(data); r.end();
        });
        console.log('CMD_TOKEN_GUARD_OK=' + (noTokStatus === 403));
        check('CMD_TOKEN_GUARD_OK',noTokStatus===403);
        // HTTP GET API (Stream Deck / Companion): GET /cmd?type=…&t=token menja stanje
        const getStatus = (u) => new Promise((resolve) => {
          http.get(`http://127.0.0.1:${serverPort}${u}`, r => { r.resume(); resolve(r.statusCode); }).on('error', () => resolve(0));
        });
        const gOK = await getStatus(`/cmd?type=setDuration&value=240000&t=${CMD_TOKEN}`);
        await new Promise(r => setTimeout(r, 400));
        const afterGet = await readState();
        const gNoTok = await getStatus(`/cmd?type=reset`);
        const gBadType = await getStatus(`/cmd?type=hakuj&t=${CMD_TOKEN}`);
        const httpGetOK=!!(gOK===200&&afterGet&&afterGet.durationMs===240000&&gNoTok===403&&gBadType===400);
        console.log('HTTP_GET_API_OK=' + httpGetOK
          + ` status=${gOK} dur=${afterGet && afterGet.durationMs} noTok=${gNoTok} badType=${gBadType}`);
        check('HTTP_GET_API_OK',httpGetOK);
        // OSC: pošalji /protimer/setDuration 180000 (int32) na UDP oscPort → stanje se menja
        const oscBuf = (() => {
          const pad = (s) => { const b = Buffer.from(s + '\0'); return Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]); };
          const arg = Buffer.alloc(4); arg.writeInt32BE(180000);
          return Buffer.concat([pad('/protimer/setDuration'), pad(',i'), arg]);
        })();
        await new Promise((resolve) => {
          const s = require('dgram').createSocket('udp4');
          s.send(oscBuf, oscPort, '127.0.0.1', () => { s.close(); resolve(); });
        });
        await new Promise(r => setTimeout(r, 400));
        const afterOsc = await readState();
        const oscOK=!!(afterOsc&&afterOsc.durationMs===180000);
        console.log('OSC_OK=' + oscOK + ` port=${oscPort} dur=${afterOsc&&afterOsc.durationMs}`);
        check('OSC_OK',oscOK);
        const backstagePage = await new Promise((resolve) => {
          http.get(`http://127.0.0.1:${serverPort}/backstage`, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(d.includes('Backstage'))); }).on('error',()=>resolve(false));
        });
        const rundownStateOK=!!(after&&Array.isArray(after.cues));
        console.log('BACKSTAGE_PAGE_OK=' + backstagePage + ' RUNDOWN_IN_STATE=' + rundownStateOK);
        check('BACKSTAGE_PAGE_OK',backstagePage); check('RUNDOWN_IN_STATE',rundownStateOK);
        // test providnosti: uključi → Ekran prozor se presozdaje providan bez pada
        await controlWin.webContents.executeJavaScript(`document.getElementById('chkTransparent').checked=true; document.getElementById('chkTransparent').dispatchEvent(new Event('change'));`);
        await new Promise(r => setTimeout(r, 1100));
        let cornerAlpha = -1;
        try {
          const img = await outputWin.webContents.capturePage();
          const bmp = img.toBitmap(); const sz = img.getSize();
          // sredina-levo: pozadina, dalje od gornje #ui trake i centriranog tajmera
          cornerAlpha = bmp[(Math.floor(sz.height * 0.5) * sz.width + 6) * 4 + 3];
        } catch (e) {}
        const transparentOK=!!outputWin&&!outputWin.isDestroyed()&&outputTransparent===true&&cornerAlpha<10;
        console.log('TRANSPARENT_RECREATE_OK=' + transparentOK + ' CORNER_ALPHA=' + cornerAlpha);
        check('TRANSPARENT_RECREATE_OK',transparentOK);
        // isključi providnost → ponovo neproziran (alfa 255)
        await controlWin.webContents.executeJavaScript(`document.getElementById('chkTransparent').checked=false; document.getElementById('chkTransparent').dispatchEvent(new Event('change'));`);
        await new Promise(r => setTimeout(r, 1100));
        let offAlpha = -1;
        try { const img = await outputWin.webContents.capturePage(); const bmp = img.toBitmap(); const sz = img.getSize(); offAlpha = bmp[(8 * sz.width + 8) * 4 + 3]; } catch (e) {}
        const opaqueOK=outputTransparent===false&&offAlpha===255;
        console.log('OPAQUE_AGAIN_OK=' + opaqueOK + ' OFF_ALPHA=' + offAlpha);
        check('OPAQUE_AGAIN_OK',opaqueOK);
        // QR generator radi i spakovan je
        let qrOK = false;
        try { const svg = await controlWin.webContents.executeJavaScript("window.pt.qr('http://192.168.1.50:7878')"); qrOK = typeof svg === 'string' && svg.includes('<svg'); } catch (e) {}
        console.log('QR_OK=' + qrOK);
        check('QR_OK',qrOK);
        // kompaktan prozor: u PROZORU (ne fullscreen) → prozor se skupi na visinu tajmera
        await controlWin.webContents.executeJavaScript("var grid=document.getElementById('chkGrid'); if(grid.checked){grid.checked=false;grid.dispatchEvent(new Event('change'));} var fit=document.getElementById('chkFit');fit.checked=false;fit.dispatchEvent(new Event('change'));");
        await new Promise(r => setTimeout(r, 700));
        await controlWin.webContents.executeJavaScript("window.pt.exitFullscreen()");
        await new Promise(r => setTimeout(r, 500));
        let fitH0 = 9999, fitH1 = 9999;
        try { const [w]=outputWin.getContentSize(); outputWin.setContentSize(w,506); } catch(e) {}
        await new Promise(r => setTimeout(r, 150));
        try { fitH0 = outputWin.getContentSize()[1]; } catch (e) {}
        await controlWin.webContents.executeJavaScript("document.getElementById('chkFit').checked=true; document.getElementById('chkFit').dispatchEvent(new Event('change'));");
        await new Promise(r => setTimeout(r, 900));
        try { fitH1 = outputWin.getContentSize()[1]; } catch (e) {}
        const fitOK=fitH1<fitH0-20&&fitH1>60;
        console.log('FIT_OK=' + fitOK + ' FIT_H=' + fitH0 + '→' + fitH1);
        check('FIT_OK',fitOK);
        // GRID: uključi grid 3×3, kockica 0 (gore-levo) → PROZOR = ta kockica monitora
        await controlWin.webContents.executeJavaScript("document.getElementById('chkFit').checked=false; document.getElementById('chkFit').dispatchEvent(new Event('change')); var g=document.getElementById('chkGrid'); g.checked=true; g.dispatchEvent(new Event('change')); document.querySelector('#gridSizes button[data-gs=\"3\"]').click(); document.querySelectorAll('#gridSel .gc')[0].click();");
        await new Promise(r => setTimeout(r, 800));
        let gridWinOK = false, gbStr = '?';
        try {
          const d = screen.getAllDisplays().find(x => x.id === outputTargetId) || screen.getPrimaryDisplay();
          const gb = outputWin.getBounds();
          const expW = Math.floor(d.bounds.width / 3), expH = Math.floor(d.bounds.height / 3);
          // ključno: prozor je VELIČINE kockice i nije fullscreen (tačan x/y zavisi od rasporeda monitora)
          gridWinOK = Math.abs(gb.width - expW) < 8 && Math.abs(gb.height - expH) < 8 && !outputWin.isFullScreen();
          gbStr = `${gb.width}x${gb.height}@${gb.x},${gb.y} (cell≈${expW}x${expH}) frameless=${outputFrameless}`;
        } catch (e) {}
        console.log('GRID_WIN_OK=' + gridWinOK + ' ' + gbStr);
        check('GRID_WIN_OK',gridWinOK);
        // REGRESIJA: biranje veličine grida NE sme da pokvari mod tajmera.
        // (Grid dugmad su u .tabs kontejneru — ranije su greškom zvala setMode(undefined),
        //  pa je START ostavljao endAt=0 → prikaz ogromnog negativnog vremena.)
        let startOK = false, gridStartStr = '?';
        try {
          await controlWin.webContents.executeJavaScript(`setDuration(530000); document.querySelector('#gridSizes button[data-gs=\"5\"]').click(); startPause();`);
          await new Promise(r => setTimeout(r, 500));
          gridStartStr = await controlWin.webContents.executeJavaScript(`(function(){var now=Date.now();return JSON.stringify({mode:S.mode,running:S.running,rem:S.endAt-now,text:calc(now).text});})()`);
          const s = JSON.parse(gridStartStr);
          startOK = s.mode === 'countdown' && s.running === true && s.rem > 0 && s.rem < 540000;
        } catch (e) { gridStartStr = 'ERR ' + e; }
        console.log('GRID_START_OK=' + startOK + ' ' + gridStartStr);
        check('GRID_START_OK',startOK);

        // Izabrani monitor mora ostati zapamćen i posle presozdavanja izlaznog prozora.
        const expectedTarget=screen.getPrimaryDisplay().id;
        outputTargetId='stale-target'; positionOutput(screen.getPrimaryDisplay());
        const outputTargetOK=outputTargetId===expectedTarget;
        console.log('OUTPUT_TARGET_OK='+outputTargetOK+' target='+outputTargetId);
        check('OUTPUT_TARGET_OK',outputTargetOK);

        // Brisanje cue-a pre aktivnog čuva isti cue; strelice u SELECT-u ne diraju trajanje.
        let cueDeleteOK=false,selectKeyOK=false,cueDeleteStr='?';
        try{
          cueDeleteStr=await controlWin.webContents.executeJavaScript(`(function(){
            cancelAutoAdvance(); autoNext=false;
            cues=[{name:'A',durationMs:60000,note:'',color:''},{name:'B',durationMs:120000,note:'',color:''},{name:'C',durationMs:180000,note:'',color:''}];
            currentCue=1; S.running=false; S.remMs=120000; renderCues();
            document.querySelectorAll('.cue .del')[0].click();
            var before=S.remMs,sel=document.getElementById('displaySel');
            sel.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
            return JSON.stringify({currentCue:currentCue,name:cues[currentCue]&&cues[currentCue].name,before:before,after:S.remMs});
          })()`);
          const value=JSON.parse(cueDeleteStr);
          cueDeleteOK=value.currentCue===0&&value.name==='B'; selectKeyOK=value.before===value.after;
        }catch(e){cueDeleteStr='ERR '+e;}
        console.log('CUE_DELETE_INDEX_OK='+cueDeleteOK+' '+cueDeleteStr);
        console.log('SELECT_KEY_OK='+selectKeyOK);
        check('CUE_DELETE_INDEX_OK',cueDeleteOK); check('SELECT_KEY_OK',selectKeyOK);

        // Ručni GO u 800 ms prozoru mora da otkaže zakazani auto-advance.
        let autoAdvanceOK=false,autoAdvanceStr='?';
        try{
          await controlWin.webContents.executeJavaScript(`(function(){
            cues=[{name:'A',durationMs:100,note:'',color:''},{name:'B',durationMs:60000,note:'',color:''},{name:'C',durationMs:60000,note:'',color:''}];
            currentCue=0; autoNext=true; setDuration(100); startPause(); renderCues();
          })()`);
          await new Promise(r=>setTimeout(r,250));
          await controlWin.webContents.executeJavaScript('go()');
          await new Promise(r=>setTimeout(r,950));
          autoAdvanceStr=await controlWin.webContents.executeJavaScript(`JSON.stringify({currentCue:currentCue,running:S.running,name:cues[currentCue]&&cues[currentCue].name})`);
          const value=JSON.parse(autoAdvanceStr); autoAdvanceOK=value.currentCue===1&&value.running===true&&value.name==='B';
          await controlWin.webContents.executeJavaScript(`autoNext=false; cancelAutoAdvance(); reset();`);
        }catch(e){autoAdvanceStr='ERR '+e;}
        console.log('AUTO_ADVANCE_CANCEL_OK='+autoAdvanceOK+' '+autoAdvanceStr);
        check('AUTO_ADVANCE_CANCEL_OK',autoAdvanceOK);

        // Viewer sa satom pomerenim +30 s mora da se uskladi sa satom hosta preko /time.
        let clockSyncOK=false,clockSyncStr='?';
        const clockWin=new BrowserWindow({show:false,webPreferences:{contextIsolation:true}});
        try{
          await clockWin.loadURL(`http://127.0.0.1:${serverPort}/`);
          await new Promise(r=>setTimeout(r,250));
          clockSyncStr=await clockWin.webContents.executeJavaScript(`(async function(){
            window.__realNow=Date.now.bind(Date); Date.now=()=>window.__realNow()+30000;
            clockSynced=false; clockSyncing=false; await syncClock(3);
            return JSON.stringify({offset:clockOffsetMs,correction:hostNow()-window.__realNow()});
          })()`);
          const value=JSON.parse(clockSyncStr);
          clockSyncOK=value.offset<-28500&&value.offset>-31500&&Math.abs(value.correction)<1500;
        }catch(e){clockSyncStr='ERR '+e;}
        clockWin.destroy();
        console.log('VIEWER_CLOCK_SYNC_OK='+clockSyncOK+' '+clockSyncStr);
        check('VIEWER_CLOCK_SYNC_OK',clockSyncOK);

        // Otvoren viewer mora odmah da prihvati nižu verziju nakon restarta servera (nova instanca).
        let instanceResetOK=true,instanceResetStr=[];
        const instanceWin=new BrowserWindow({show:false,webPreferences:{contextIsolation:true}});
        try{
          for(const route of ['/','/remote','/backstage']){
            await instanceWin.loadURL(`http://127.0.0.1:${serverPort}${route}`);
            await new Promise(r=>setTimeout(r,200));
            const value=await instanceWin.webContents.executeJavaScript(`(function(){
              var current=S||{}; lastStateVersion=99; lastServerInstance='old-instance';
              var accepted=applyState(Object.assign({},current,{_version:1,_instance:'new-instance'}));
              return {accepted:accepted,version:lastStateVersion,instance:lastServerInstance};
            })()`);
            instanceResetStr.push(route+':'+JSON.stringify(value));
            instanceResetOK=instanceResetOK&&value.accepted===true&&value.version===1&&value.instance==='new-instance';
          }
        }catch(e){instanceResetOK=false;instanceResetStr.push('ERR '+e);}
        instanceWin.destroy();
        console.log('VIEWER_INSTANCE_RESET_OK='+instanceResetOK+' '+instanceResetStr.join(' '));
        check('VIEWER_INSTANCE_RESET_OK',instanceResetOK);

        // Backstage sa 100 cue-ova ne sme ponovo da gradi rundown dok samo tajmer teče.
        let backstagePerfOK=false,backstagePerfStr='?';
        const perfWin=new BrowserWindow({width:390,height:844,show:false,webPreferences:{contextIsolation:true}});
        try{
          await controlWin.webContents.executeJavaScript(`(function(){
            cues=Array.from({length:100},(_,i)=>({name:'Cue '+(i+1),durationMs:60000,note:'N '+i,color:i%2?'#4493f8':''}));
            currentCue=20; S.showStart='10:00'; autoNext=false; setDuration(3000); startPause(); renderCues();
          })()`);
          await perfWin.loadURL(`http://127.0.0.1:${serverPort}/backstage`);
          await new Promise(r=>setTimeout(r,500));
          await perfWin.webContents.executeJavaScript(`window.__schedMutations=0;window.__timerBefore=document.getElementById('nowTimer').textContent;
            window.__schedObserver=new MutationObserver(m=>window.__schedMutations+=m.length);
            window.__schedObserver.observe(document.getElementById('sched'),{subtree:true,childList:true,characterData:true,attributes:true});`);
          await new Promise(r=>setTimeout(r,1300));
          backstagePerfStr=await perfWin.webContents.executeJavaScript(`JSON.stringify({mutations:window.__schedMutations,count:document.querySelectorAll('#sched .ev').length,before:window.__timerBefore,after:document.getElementById('nowTimer').textContent})`);
          const value=JSON.parse(backstagePerfStr);
          backstagePerfOK=value.mutations===0&&value.count===100&&value.before!==value.after;
        }catch(e){backstagePerfStr='ERR '+e;}
        perfWin.destroy();
        console.log('BACKSTAGE_PERF_OK='+backstagePerfOK+' '+backstagePerfStr);
        check('BACKSTAGE_PERF_OK',backstagePerfOK);

        // CSV/TSV uvoz rundown-a: zaglavlje se preskače, "," ";" i TAB rade, navodnici čuvaju zarez
        let csvOK = false, csvStr = '?';
        try {
          csvStr = await controlWin.webContents.executeJavaScript(`JSON.stringify(parseRundownCSV(
            'name,duration,note\\nWelcome,10:00,"Emma, host"\\nSession;25:00;Liam\\nPanel;15:00;"Emma, host"\\nLunch\\t1:00:00\\tlobby\\nbad row,,x\\n'))`);
          const rows = JSON.parse(csvStr);
          csvOK = rows.length === 4 && rows[0].durationMs === 600000 && rows[0].note === 'Emma, host'
            && rows[1].durationMs === 1500000 && rows[2].note === 'Emma, host' && rows[3].durationMs === 3600000;
        } catch (e) { csvStr = 'ERR ' + e; }
        console.log('CSV_OK=' + csvOK + (csvOK ? '' : ' ' + csvStr));
        check('CSV_OK',csvOK);
        if(smokeFailures.length) throw new Error('Failed checks: '+smokeFailures.join(', '));
        console.log('SMOKE_OK');
        app.exit(0);
      } catch (err) { console.error('SMOKE_FAIL', err); app.exit(1); }
    })();
    setTimeout(() => { console.error('SMOKE_TIMEOUT'); app.exit(1); }, 45000);
  }
});

app.on('window-all-closed', () => app.quit());
