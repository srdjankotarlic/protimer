const {test}=require('node:test');
const assert=require('node:assert/strict');
const {freeLayout,freeElements,freePosition,hasFreeLayout,audienceState,outputState,secondary}=require('../timer-tools');

test('free layout uses safe independent defaults and sanitizes each element',()=>{
  const defaults=freeLayout(null,true,'columns');
  assert.deepEqual(Object.keys(defaults),[...freeElements]);
  assert.ok(defaults.primary.x<0&&defaults.secondary.x>0);
  assert.ok(freePosition('primary',true,'rows').y<freePosition('secondary',true,'rows').y);
  const next=freeLayout({primary:{x:900,y:'bad',scale:-1},message:{y:-100},bogus:{}},true,'columns');
  assert.deepEqual(next.primary,{x:100,y:0,scale:10});
  assert.equal(next.message.y,-100);
  assert.deepEqual(next.secondary,defaults.secondary);
  assert.deepEqual(freeLayout(JSON.parse(JSON.stringify(next)),true,'columns'),next);
  assert.equal(defaults.message.y,58);
});

test('free layout is opt-in and never leaks into separate physical output placement',()=>{
  assert.equal(hasFreeLayout({freeAudience:'true'}),false);
  const state={dualTimer:true,separateOutputs:true,freeAudience:true,secondary:secondary()};
  assert.equal(hasFreeLayout(state),false);
  assert.equal(hasFreeLayout(outputState(state)),false);
  assert.equal(hasFreeLayout(outputState(state,'secondary')),false);
  assert.equal(hasFreeLayout({...state,separateOutputs:false}),true);
});

test('one selected live timer keeps its free anchor without changing source layouts or clocks',()=>{
  const state={dualTimer:true,freeAudience:true,liveTimerView:'t2',dualSplit:'rows',
    running:true,endAt:4444,secondary:{...secondary(),running:true,endAt:5555},
    freeLayout:freeLayout({secondary:{x:12,y:-30,scale:75}},true,'rows')};
  const before=structuredClone(state),t2=audienceState(state);
  assert.equal(t2.dualTimer,false);
  assert.equal(t2.endAt,5555);
  assert.deepEqual(t2.freeLayout.primary,{x:12,y:-30,scale:75});
  assert.deepEqual(state,before);
  const t1=audienceState({...state,liveTimerView:'t1'});
  assert.deepEqual(t1.freeLayout.primary,state.freeLayout.primary);
  assert.equal(t1.endAt,4444);
});
