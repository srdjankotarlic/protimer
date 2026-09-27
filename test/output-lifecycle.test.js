const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');

// Exercise the actual main-process lifecycle and IPC handlers without Electron,
// network listeners, user data, or native windows. Startup is intentionally idle.
function fixture(platform='darwin') {
  const root=path.join(__dirname,'..'), requireRoot=createRequire(path.join(root,'main.js'));
  const handlers=new Map(), listeners=new Map(), windows=[];
  const displays=[{id:1,bounds:{x:0,y:0,width:1600,height:900},workArea:{x:0,y:0,width:1600,height:900},scaleFactor:1},
    {id:2,bounds:{x:1600,y:0,width:1920,height:1080},workArea:{x:1600,y:0,width:1920,height:1080},scaleFactor:1}];
  class Window extends EventEmitter {
    constructor(options={}) {
      super(); this.options=options; this.bounds={x:0,y:0,width:900,height:506};
      this.webContents=new EventEmitter(); this.webContents.send=()=>{}; this.webContents.getZoomFactor=()=>1;
      windows.push(this);
    }
    isDestroyed(){return !!this.dead;} isFullScreen(){return !!this.full;} isFocused(){return !!this.focused;}
    getBounds(){return this.bounds;} getContentSize(){return [this.bounds.width,this.bounds.height];}
    setBounds(bounds){this.bounds=bounds;this.emit('move');this.emit('resize');}
    setContentSize(width,height){this.setBounds({...this.bounds,width,height});}
    setFullScreen(value){this.full=value;this.emit(value?'enter-full-screen':'leave-full-screen');}
    setAlwaysOnTop(){} show(){this.shown=true;} loadFile(){}
    destroy(){this.dead=true;this.emit('closed');} close(){this.destroy();}
  }
  const electron={app:{on(){},whenReady:()=>({then(){}})},BrowserWindow:Window,
    ipcMain:{on:(name,fn)=>listeners.set(name,fn),handle:(name,fn)=>handlers.set(name,fn)},
    screen:{getAllDisplays:()=>displays,getPrimaryDisplay:()=>displays[0],
      getDisplayMatching:bounds=>displays.find(d=>bounds.x>=d.bounds.x&&bounds.x<d.bounds.x+d.bounds.width)||displays[0]}};
  const context=vm.createContext({require:name=>name==='electron'?electron:requireRoot(name),__dirname:root,
    process:{argv:[],platform,env:{}},console,Buffer,URL,URLSearchParams,AbortController,
    setTimeout,clearTimeout,setImmediate,setInterval(){}});
  vm.runInContext(fs.readFileSync(path.join(root,'main.js'),'utf8'),context);
  const run=script=>vm.runInContext(script,context);
  run('controlWin=new BrowserWindow();lastState={dualTimer:true,separateOutputs:true,gridOn:false};');
  const event={sender:run('controlWin.webContents')};
  return {run,displays,windows,handlers,
    resize:size=>handlers.get('resize-output')(event,size),
    state:value=>listeners.get('state')(event,value),
    current:()=>run('outputWin'),read:script=>JSON.parse(JSON.stringify(run(script)))};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('primary size request on a new output settles when closed before first paint',async()=>{
  const f=fixture(),pending=f.resize({displayId:1,width:800,height:600}),old=f.current();
  old.close();
  const result=await Promise.race([pending,new Promise(resolve=>setTimeout(()=>resolve('timeout'),50))]);
  assert.notEqual(result,'timeout'); assert.equal(result.ok,false);
  assert.equal(f.current(),null);
  assert.equal(old.listenerCount('closed'),1,'Only the lifecycle listener remains after request cleanup');
});
test('primary early resize never targets a replacement output',async()=>{
  const f=fixture(),pending=f.resize({displayId:1,width:800,height:600}),old=f.current();
  old.destroy();f.run('createOutputWindow(2)');const replacement=f.current();
  replacement.emit('ready-to-show'); await tick();
  assert.equal((await pending).ok,false);
  assert.deepEqual(f.read('outputWin.getBounds()'),f.displays[1].bounds);
  assert.equal(replacement.isFullScreen(),true);
});
test('primary resize waits for an already-opening output and then applies its exact size',async()=>{
  const f=fixture();f.run('createOutputWindow(1)');const win=f.current();
  const pending=f.resize({displayId:1,width:800,height:600});
  assert.deepEqual(win.getContentSize(),[900,506]);
  win.emit('ready-to-show');const result=await pending;
  assert.equal(result.ok,true);assert.deepEqual(win.getContentSize(),[800,600]);
  assert.equal(win.listenerCount('ready-to-show'),0);
  assert.equal(win.listenerCount('closed'),1);
});
test('Apply on a closed primary output shows its exact requested size on the requested monitor',async()=>{
  const f=fixture();f.run('lastState.outputSize={width:800,height:600}');
  const pending=f.resize({displayId:2,width:800,height:600}),win=f.current();
  win.emit('ready-to-show');const result=await pending;
  assert.equal(result.ok,true);assert.equal(win.shown,true);
  assert.deepEqual(f.read('outputWin.getBounds()'),{x:1600,y:0,width:800,height:600});
  assert.equal(f.run('outputGeometry().displayId'),2);
});
test('primary background Spaces moves retain routing target and do not reflow on unrelated metrics',async()=>{
  const f=fixture();f.run('lastState.gridOn=true;lastState.gridSize=3;lastState.gridCell=8;createOutputWindow(2)');
  const win=f.current();win.emit('ready-to-show');await tick();
  const revision=f.run('outputPlacementVersion'),relocated={x:0,y:0,width:460,height:258};
  win.emit('will-move',{},relocated);win.setBounds(relocated);
  assert.equal(f.run('outputGeometry().displayId'),1,'Geometry reports the actual transient monitor');
  assert.equal(f.run('outputTargetId'),2,'Native movement must not change routing intent');
  f.run('OutputQuality.reflowGridForDisplay({win:outputWin,display:screen.getAllDisplays()[0],metrics:["workArea"],state:lastState,targetId:outputTargetId,placing:outputPlacing!==null,beforeMove:()=>++outputPlacementVersion})');
  assert.deepEqual(win.getBounds(),relocated);
  assert.equal(f.run('outputPlacementVersion'),revision,'Sibling-bound restoration remains eligible');
  f.state({dualTimer:true,separateOutputs:true,gridOn:true,gridSize:3,gridCell:0});await tick();
  assert.deepEqual(f.read('outputWin.getBounds()'),{x:1600,y:0,width:640,height:360});
});
for(const platform of ['darwin','win32','linux'])test(`primary manual drag adopts destination monitor on ${platform}`,async()=>{
  const f=fixture(platform);f.run('createOutputWindow(1)');const win=f.current();win.emit('ready-to-show');await tick();
  const revision=f.run('outputPlacementVersion'),dragged={x:1700,y:100,width:800,height:600};
  win.focused=true;
  if(platform!=='linux')win.emit('will-move',{},dragged);
  win.setBounds(dragged);
  assert.equal(f.run('outputTargetId'),2);
  assert.ok(f.run('outputPlacementVersion')>revision);
  f.state({dualTimer:true,separateOutputs:true,gridOn:true,gridSize:3,gridCell:0});await tick();
  assert.deepEqual(f.read('outputWin.getBounds()'),{x:1600,y:0,width:640,height:360});
});
