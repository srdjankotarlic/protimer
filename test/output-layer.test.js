const { test } = require('node:test');
const assert = require('node:assert/strict');
const tools = require('../timer-tools');
const { applyOutputLayer } = require('../window-tools');

test('legacy automatic top behavior survives; explicit normal overrides Grid and transparency', () => {
  for (const transparent of [true, false]) for (const gridOn of [true, false]) {
    assert.equal(tools.outputOnTop({ transparent, gridOn }), transparent || gridOn);
    assert.equal(tools.outputOnTop({ transparent, gridOn, outputLayer: 'above' }), true);
    assert.equal(tools.outputOnTop({ transparent, gridOn, outputLayer: 'normal' }), false);
  }
  for (const value of [undefined, null, {}, 'bottom', '<script>', 1]) assert.equal(tools.outputLayer(value), 'auto');
});

test('separate output layers never inherit each other, and persistence is sanitized', () => {
  const s = { dualTimer:true, separateOutputs:true, outputLayer:'above', secondary:tools.secondary({outputLayer:'normal'}) };
  const before = structuredClone(s);
  assert.equal(tools.outputState(s).outputLayer, 'above');
  assert.equal(tools.outputState(s, 'secondary').outputLayer, 'normal');
  assert.deepEqual(s, before);
  assert.equal(tools.secondary(JSON.parse(JSON.stringify(s.secondary))).outputLayer, 'normal');
  assert.equal(tools.secondary({}, {outputLayer:'above'}).outputLayer, 'auto');
  assert.equal(tools.secondary({outputLayer:'bad'}).outputLayer, 'auto');
  s.separateOutputs=false;
  assert.equal(tools.outputState(s),s,'Combined windows use the primary window policy');
});

function window() {
  return { dead:false, calls:[], isDestroyed(){return this.dead;},
    setAlwaysOnTop(...args){this.calls.push(['top',...args]);},
    setVisibleOnAllWorkspaces(...args){this.calls.push(['spaces',...args]);},
    moveTop(){this.calls.push(['raise']);} };
}
test('macOS overlays support fullscreen Spaces without native churn on every clock tick', () => {
  const win=window(), opts={platform:'darwin'}, state={outputLayer:'above',running:true,endAt:123456};
  applyOutputLayer(win,state,opts);
  assert.deepEqual(win.calls,[['top',true,'screen-saver',1],['spaces',true,{visibleOnFullScreen:true}],['raise']]);
  for(let i=0;i<1000;i++) applyOutputLayer(win,{...state,remMs:100000-i},opts);
  assert.equal(win.calls.length,3);
  applyOutputLayer(win,{...state,outputLayer:'normal',gridOn:true,transparent:true},opts);
  assert.deepEqual(win.calls.slice(3),[['top',false,'floating',0],['spaces',false,{visibleOnFullScreen:false}]]);
  assert.equal(state.endAt,123456);assert.equal(state.running,true);
});
test('Windows never calls macOS workspace APIs; windows have independent native caches', () => {
  const a=window(),b=window(),opts={platform:'win32'};
  applyOutputLayer(a,{outputLayer:'above'},opts);
  applyOutputLayer(b,{outputLayer:'normal'},opts);
  assert.deepEqual(a.calls,[['top',true,'screen-saver',0],['raise']]);
  assert.deepEqual(b.calls,[['top',false,'floating',0]]);
  applyOutputLayer(a,{outputLayer:'normal'},opts);
  assert.equal(b.calls.length,1);
  b.dead=true; applyOutputLayer(b,{outputLayer:'above'},opts);
  assert.equal(b.calls.length,1);
  applyOutputLayer(null,{},opts);
});
test('automatic legacy macOS mode does not change workspaces; updated modes do not require new IPC', () => {
  const win=window();applyOutputLayer(win,{gridOn:true},{platform:'darwin'});
  assert.deepEqual(win.calls,[['top',true,'floating',0]]);
  const fs=require('node:fs'),path=require('node:path');
  const html=fs.readFileSync(path.join(__dirname,'../controller.html'),'utf8');
  assert.match(html,/outputLayer:TimerTools\.outputLayer\(S\.outputLayer\)/);
  assert.match(html,/outputLayer:TimerTools\.outputLayer\(S\.secondary\.outputLayer\)/);
  assert.match(html,/outputLayer:TimerTools\.outputOnTop\(st\)\?'above':'normal'/);
  assert.ok(html.includes('id="chkOutputOnTop"'));
  assert.ok(html.includes('id="chkSecondaryOutputOnTop"'));
  assert.ok(!html.includes('id="outputLayer"'),'No multi-mode UI');
  assert.ok(require('../package.json').build.files.includes('scripts/smoke-output-layer.js'));
});
test('placement/fullscreen refresh restores presentation level without focus, geometry or timer changes',()=>{
  const win=window(),s={outputLayer:'above'};
  applyOutputLayer(win,s,{platform:'darwin'});win.calls=[];
  applyOutputLayer(win,s,{platform:'darwin',refresh:true});
  assert.deepEqual(win.calls,[['top',true,'screen-saver',1],['raise']]);
});
