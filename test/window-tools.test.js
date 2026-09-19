const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { leaveFullscreen, preserveSiblingBounds } = require('../window-tools');

class FakeWindow extends EventEmitter {
  full = true;
  destroyed = false;
  calls = 0;
  isFullScreen() { return this.full; }
  isDestroyed() { return this.destroyed; }
  setFullScreen(value) { this.calls++; this.emit('leave-full-screen'); this.full = value; }
}
test('Windows event-before-state ordering is awaited and concurrent calls share one exit', async () => {
  const win = new FakeWindow();
  const first = leaveFullscreen(win), second = leaveFullscreen(win);
  assert.equal(first, second);
  assert.equal(await first, true);
  assert.equal(win.calls, 1);
  win.full = true;
  assert.equal(await leaveFullscreen(win), true); // no stale resolved promise
  assert.equal(win.calls, 2);
  assert.equal(win.listenerCount('leave-full-screen'), 0);
});
test('macOS asynchronous transitions finish before applying a size', async () => {
  const win = new FakeWindow();
  win.setFullScreen = value => setTimeout(() => { win.full = value; win.emit('leave-full-screen'); }, 10);
  assert.equal(await leaveFullscreen(win), true);
  assert.equal(win.full, false);
});
test('closed windows and failed transitions do not allow sizing', async () => {
  const win = new FakeWindow();
  win.setFullScreen = () => {};
  assert.equal(await leaveFullscreen(win, 10), false);
  win.destroyed = true;
  assert.equal(await leaveFullscreen(win), false);
});

function guardFixture(){
  const source=new FakeWindow(), sibling=new FakeWindow(); sibling.full=false;
  const original={x:10,y:40,width:640,height:360};
  sibling.bounds={...original}; sibling.getBounds=()=>({...sibling.bounds});
  sibling.setBounds=b=>{sibling.bounds={...b};};
  let revision=0, displays=[{id:1}];
  const options={platform:'darwin',getSibling:()=>({window:sibling,revision}),screen:{getDisplayMatching:()=>({id:1}),getAllDisplays:()=>displays}};
  const finish=async()=>{sibling.bounds={x:0,y:0,width:460,height:258};source.emit('leave-full-screen');await new Promise(r=>setImmediate(r));};
  return {source,sibling,original,options,finish,reroute:()=>revision++,disconnect:()=>displays=[]};
}
test('native macOS fullscreen restores the other output without changing its chosen size',async()=>{
  const f=guardFixture();preserveSiblingBounds(f.source,false,f.options);await f.finish();
  assert.deepEqual(f.sibling.bounds,f.original);
  assert.equal(f.sibling.listenerCount('will-move'),0);
  assert.equal(f.source.listenerCount('closed'),0);
});
test('fullscreen preservation never overrides a new operator action, disconnected display or closed window',async()=>{
  for(const change of [f=>f.sibling.emit('will-move'),f=>f.sibling.emit('will-resize'),f=>f.reroute(),f=>f.disconnect(),f=>{f.sibling.destroyed=true;}]){
    const f=guardFixture();preserveSiblingBounds(f.source,false,f.options);change(f);await f.finish();
    assert.notDeepEqual(f.sibling.bounds,f.original);
  }
});
test('sibling geometry protection does not run on Windows/Linux or change fullscreen siblings',async()=>{
  for(const platform of ['win32','linux']){
    const f=guardFixture();preserveSiblingBounds(f.source,false,{...f.options,platform});await f.finish();
    assert.notDeepEqual(f.sibling.bounds,f.original);
  }
  const f=guardFixture();f.sibling.full=true;preserveSiblingBounds(f.source,false,f.options);await f.finish();
  assert.notDeepEqual(f.sibling.bounds,f.original);
});
