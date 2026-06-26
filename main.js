const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');

const SMOKE = process.argv.includes('--smoke');

let controlWin = null;
let outputWin = null;
let lastState = null;
let outputTransparent = false;   // da li je trenutni Ekran prozor providan
let outputTargetId = null;       // na kom monitoru je Ekran

// ---------------- MREŽNI IZLAZ (OBS Browser Source / NDI most / confidence monitor) ----------------
let server = null;
let serverPort = 0;
const sseClients = new Set();

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

    // komande sa daljinskog (telefon/tablet) → prosledi kontrolnom prozoru
    if (url === '/cmd' && req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
      req.on('end', () => {
        try {
          const cmd = JSON.parse(body || '{}');
          if (controlWin && !controlWin.isDestroyed()) controlWin.webContents.send('remote-cmd', cmd);
        } catch (e) {}
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end('{"ok":true}');
      });
      return;
    }

    if (url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write('retry: 1000\n\n');
      if (lastState) res.write('data: ' + JSON.stringify(lastState) + '\n\n');
      sseClients.add(res);
      const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 15000);
      req.on('close', () => { clearInterval(ping); sseClients.delete(res); });
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

  server.listen(port, '0.0.0.0', () => {
    serverPort = port;
    pushNetworkInfo();
  });
}

function pushSSE(state) {
  const data = 'data: ' + JSON.stringify(state) + '\n\n';
  for (const res of sseClients) { try { res.write(data); } catch (e) { sseClients.delete(res); } }
}

function networkInfo() {
  return { ip: lanIP(), port: serverPort, running: !!serverPort, clients: sseClients.size };
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
  const ctlId = controlDisplayId();
  if (target.id !== ctlId) {
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
  outputTransparent = transparent;

  outputWin = new BrowserWindow({
    width: 900, height: 506, minWidth: 320, minHeight: 180, show: false,
    title: 'ProTimer — Ekran',
    backgroundColor: transparent ? '#00000000' : '#000000',
    transparent: transparent,
    frame: !transparent,
    hasShadow: !transparent,
    alwaysOnTop: transparent,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  if (transparent) outputWin.setAlwaysOnTop(true, 'floating');
  outputWin.loadFile('output.html');
  if (SMOKE) outputWin.webContents.on('console-message', (e, l, m, ln) => console.log(`OUT_CONSOLE [${l}] ${m} (line ${ln})`));
  outputWin.webContents.on('did-finish-load', () => {
    if (lastState) outputWin.webContents.send('state', lastState);
    pushDisplays();
  });
  outputWin.once('ready-to-show', () => positionOutput(target));
  outputWin.on('closed', () => { outputWin = null; pushOutputState(); pushDisplays(); });
  pushOutputState();
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
  lastState = s;
  if (outputWin && !outputWin.isDestroyed()) {
    if (!!s.transparent !== outputTransparent) {
      recreateOutputForTransparency();   // providnost se menja → novi prozor
    } else {
      outputWin.webContents.send('state', s);
    }
  }
  pushSSE(s);
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
ipcMain.on('ctl-on-top', (e, flag) => { if (controlWin && !controlWin.isDestroyed()) controlWin.setAlwaysOnTop(!!flag, 'floating'); });
ipcMain.handle('displays', () => displayList());
ipcMain.handle('output-open', () => !!outputWin);
ipcMain.handle('network-info', () => networkInfo());

// ---------------- QR KOD + JAVNI LINK (tunel) ----------------
let tunnel = null, tunnelUrl = null, tunnelStarting = false;

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
    controlWin.webContents.send('share-info', { url: tunnelUrl, starting: tunnelStarting });
}

ipcMain.handle('share-start', async () => {
  if (tunnel) return { url: tunnelUrl };
  tunnelStarting = true; pushShare();
  try {
    const localtunnel = require('localtunnel');
    tunnel = await localtunnel({ port: serverPort });
    tunnelUrl = tunnel.url;
    tunnel.on('close', () => { tunnel = null; tunnelUrl = null; tunnelStarting = false; pushShare(); });
    tunnel.on('error', () => { try { tunnel && tunnel.close(); } catch (e) {} tunnel = null; tunnelUrl = null; tunnelStarting = false; pushShare(); });
    tunnelStarting = false; pushShare();
    return { url: tunnelUrl };
  } catch (err) {
    tunnel = null; tunnelUrl = null; tunnelStarting = false; pushShare();
    return { error: (err && err.message) || 'fail' };
  }
});
ipcMain.handle('share-stop', () => {
  try { if (tunnel) tunnel.close(); } catch (e) {}
  tunnel = null; tunnelUrl = null; tunnelStarting = false; pushShare();
  return true;
});
ipcMain.handle('share-info', () => ({ url: tunnelUrl, starting: tunnelStarting }));
app.on('before-quit', () => { try { if (tunnel) tunnel.close(); } catch (e) {} });

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
  startServer(7878);
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
        const postCmd = (obj) => new Promise((resolve) => {
          const data = JSON.stringify(obj);
          const r = http.request(`http://127.0.0.1:${serverPort}/cmd`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
            res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(d)); });
          r.on('error', () => resolve(null)); r.write(data); r.end();
        });
        const sse = await readState();
        console.log('SSE_OK=' + (sse && sse.mode === 'countdown' && sse.durationMs > 0) + ' SSE_MODE=' + (sse && sse.mode));

        // test daljinskog: /remote stranica + POST komanda menja stanje
        const remotePage = await new Promise((resolve) => {
          http.get(`http://127.0.0.1:${serverPort}/remote`, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(d.includes('Daljinski'))); }).on('error',()=>resolve(false));
        });
        await postCmd({ type: 'setDuration', value: 300000 });
        await new Promise(r => setTimeout(r, 400));
        const after = await readState();
        console.log('REMOTE_PAGE_OK=' + remotePage + ' REMOTE_CMD_OK=' + (after && after.durationMs === 300000));
        const backstagePage = await new Promise((resolve) => {
          http.get(`http://127.0.0.1:${serverPort}/backstage`, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(d.includes('Backstage'))); }).on('error',()=>resolve(false));
        });
        console.log('BACKSTAGE_PAGE_OK=' + backstagePage + ' RUNDOWN_IN_STATE=' + (after && Array.isArray(after.cues)));
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
        console.log('TRANSPARENT_RECREATE_OK=' + (!!outputWin && !outputWin.isDestroyed() && outputTransparent === true) + ' CORNER_ALPHA=' + cornerAlpha);
        // isključi providnost → ponovo neproziran (alfa 255)
        await controlWin.webContents.executeJavaScript(`document.getElementById('chkTransparent').checked=false; document.getElementById('chkTransparent').dispatchEvent(new Event('change'));`);
        await new Promise(r => setTimeout(r, 1100));
        let offAlpha = -1;
        try { const img = await outputWin.webContents.capturePage(); const bmp = img.toBitmap(); const sz = img.getSize(); offAlpha = bmp[(8 * sz.width + 8) * 4 + 3]; } catch (e) {}
        console.log('OPAQUE_AGAIN_OK=' + (outputTransparent === false) + ' OFF_ALPHA=' + offAlpha);
        // QR generator radi i spakovan je
        let qrOK = false;
        try { const svg = await controlWin.webContents.executeJavaScript("window.pt.qr('http://192.168.1.50:7878')"); qrOK = typeof svg === 'string' && svg.includes('<svg'); } catch (e) {}
        console.log('QR_OK=' + qrOK);
        console.log('SMOKE_OK');
        app.exit(0);
      } catch (err) { console.error('SMOKE_FAIL', err); app.exit(1); }
    })();
    setTimeout(() => { console.error('SMOKE_TIMEOUT'); app.exit(1); }, 25000);
  }
});

app.on('window-all-closed', () => app.quit());
