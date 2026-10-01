// Developer-only contact sheet, rendered from the exact LCD SVGs by Electron.
// This is a visual preview, never a physical Stream Deck verification.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
app.whenReady().then(async()=>{
  const {keyImage,keyImageDataUrl}=await import('../.test-build/logic.js');
  const L=require('../../deck-layout');
  const active={mode:'countdown',status:'RUNNING',running:true,version:4,remainingMs:523000,enabled:true};
  const state={singleTap:true,selectedTimerId:'t1',editTarget:'set',blackout:false,liveTimerView:'t1',separateOutputs:false,outputs:{aOpen:true,bOpen:false},timers:{t1:{active,draft:{mode:'countdown',durationMs:900000,version:8,status:'READY'}},t2:{active:{...active,status:'READY',running:false},draft:{mode:'countdown',durationMs:600000,version:3,status:'READY'}}}};
  const board=L.defaultLayout('full');
  const keys=board.slots.map(key=>`<img width="144" height="144" src="${keyImageDataUrl(keyImage(key,state))}">`).join('');
  const html=`<!doctype html><meta charset="UTF-8"><style>body{margin:0;background:#080d14;color:#fff;font:16px system-ui;padding:32px}h1{font-size:26px;margin:0 0 8px}p{color:#9bb0c8;margin:0 0 24px}.board{display:grid;grid-template-columns:repeat(8,144px);gap:12px}footer{margin-top:24px;color:#9bb0c8}</style><h1>ProTimer · Stream Deck XL</h1><p>ONE KEY. ONE COMMAND. · Active and prepared time stay separate.</p><div class="board">${keys}</div><footer>LCD design preview · Actual SVG renderer · Not a USB hardware test</footer>`;
  const win=new BrowserWindow({width:1320,height:820,show:false,webPreferences:{sandbox:true}});
  await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
  await win.webContents.executeJavaScript('Promise.all([...document.images].map(i=>i.decode()))');
  const output=path.resolve(__dirname,'../../tmp/stream-deck-design.png');
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,(await win.webContents.capturePage()).toPNG());
  console.log(output);win.destroy();app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
