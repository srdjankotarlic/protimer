const {test}=require('node:test');
const assert=require('node:assert/strict');
const {livePlan}=require('../deck-output-plan');
const displays=[{id:10},{id:20}],state={dualTimer:true,separateOutputs:false,secondary:{}};
const request={mode:'auto',displayId:10,secondaryDisplayId:20};
test('all three LIVE commands use the Control-selected combined screen, fullscreen by default',()=>{
  for(const view of ['t1','both','t2'])assert.deepEqual(livePlan(state,{...request,view},displays),{ok:true,outputs:[{role:'primary',displayId:10,presentation:'fullscreen'}],close:[]});
});
test('separate routing sends only the requested timer, or both selected displays',()=>{
  const s={...state,separateOutputs:true};
  assert.deepEqual(livePlan(s,{...request,view:'t2'},displays),{ok:true,outputs:[{role:'secondary',displayId:20,presentation:'fullscreen'}],close:['primary']});
  assert.deepEqual(livePlan(s,{...request,view:'t1'},displays).close,['secondary']);
  assert.deepEqual(livePlan(s,{...request,view:'both'},displays).outputs.map(o=>o.displayId),[10,20]);
});
test('Grid, explicit window and explicit fullscreen remain deliberate Control choices',()=>{
  const s={...state,gridOn:true};
  assert.equal(livePlan(s,{...request,view:'both'},displays).outputs[0].presentation,'window');
  assert.equal(livePlan(s,{...request,view:'t1',mode:'fullscreen'},displays).outputs[0].presentation,'fullscreen');
  assert.equal(livePlan(state,{...request,view:'t2',mode:'window'},displays).outputs[0].presentation,'window');
  assert.equal(livePlan({...state,separateOutputs:true,secondary:{gridOn:true}},{...request,view:'t2'},displays).outputs[0].presentation,'window');
});
test('invalid/disconnected/same-display routing fails before any window action',()=>{
  assert.equal(livePlan(state,{...request,view:'t1',displayId:99},displays).code,'DISPLAY_NOT_CONNECTED');
  assert.equal(livePlan({...state,dualTimer:false},{...request,view:'t2'},displays).code,'TIMER_DISABLED');
  assert.equal(livePlan({...state,dualTimer:false},{...request,view:'both'},displays).code,'TIMER_DISABLED');
  assert.equal(livePlan({...state,separateOutputs:true},{...request,view:'both',secondaryDisplayId:10},displays).code,'SAME_DISPLAY');
  for(const patch of [{view:'other'},{mode:'shell'},{view:undefined}])assert.equal(livePlan(state,{...request,view:'t1',...patch},displays).code,'INVALID_LIVE_OUTPUT');
});
test('LIVE planning cannot mutate clocks, draft values, saved grid or routing',()=>{
  const s={...state,endAt:12345,running:true,secondary:{endAt:45678,running:true,gridOn:true}};
  const before=JSON.stringify(s);for(const view of ['t1','both','t2'])livePlan(s,{...request,view},displays);
  assert.equal(JSON.stringify(s),before);
});
