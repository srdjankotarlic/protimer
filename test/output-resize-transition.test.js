const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {leaveFullscreen,applyContentSize}=require('../window-tools');
const TimerTools=require('../timer-tools');
test('real primary resize handler ignores Windows restoration will-move without cancelling size or changing target',async()=>{
  const source=readFileSync(require.resolve('../main'),'utf8');
  const start=source.indexOf("ipcMain.handle('resize-output',"),end=source.indexOf('// kompaktan prozor:',start);
  const move=source.match(/const operatorMove = \(_event, bounds\) => \{[\s\S]*?\n  \};/)[0];
  const win=new EventEmitter();let full=true,size=[1920,1080];
  win.isDestroyed=()=>false;win.isFocused=()=>true;win.isFullScreen=()=>full;
  win.setFullScreen=v=>{win.emit('will-move',{}, {x:0,y:0});win.emit('leave-full-screen');full=v;};
  win.setContentSize=()=>{win.emit('will-move',{}, {x:0,y:0});}; // reproduce restored Windows no-op
  win.getContentSize=()=>size;
  win.getBounds=()=>({x:0,y:0,width:size[0],height:size[1]});
  let attempts=0;
  win.setBounds=b=>{if(++attempts>1)size=[b.width,b.height];};
  let handler;const sender={};
  const context={process:{platform:'win32'},SMOKE:false,ipcMain:{handle:(_name,fn)=>handler=fn},TimerTools,controlWin:{webContents:sender},outputWin:win,current:win,
    outputReady:true,outputPlaced:true,outputPlacing:null,outputPlacementVersion:0,outputTargetId:1,lastState:{gridOn:false,fitWindow:false},
    screen:{getAllDisplays:()=>[{id:1}],getDisplayMatching:()=>({id:1})},leaveOutputFullscreen:()=>leaveFullscreen(win),
    applyContentSize:(w,s,options)=>applyContentSize(w,s,{...options,platform:'win32'}),
    pushOutputGeometry:()=>{},outputGeometry:()=>({width:size[0],height:size[1],fullscreen:full})};
  vm.runInNewContext(move+"\noutputWin.on('will-move',operatorMove);\n"+source.slice(start,end),context);
  const result=await handler({sender},{width:1280,height:720});
  assert.equal(result.ok,true);assert.deepEqual(size,[1280,720]);assert.equal(full,false);
  assert.equal(context.outputTargetId,1);assert.equal(context.outputPlacementVersion,1);assert.equal(context.outputPlacing,null);
  // Once our operation completes, a real focused drag still takes precedence.
  win.emit('will-move',{}, {x:10,y:20});assert.equal(context.outputPlacementVersion,2);
});
