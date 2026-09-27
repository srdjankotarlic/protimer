const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const vm = require('node:vm');
const { MAX_CAPTURE_PIXELS, MEASURE_RENDERER, displayInfo, outputGeometry, reflowGridForDisplay, createQualityReader, pngDimensions } = require('../output-quality');

function png(width, height) {
  const bytes = Buffer.alloc(24);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
  bytes.write('IHDR', 12); bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20);
  return bytes;
}
function fixture(scaleFactor = 1) {
  let display = { id: 2, label: 'Stage TV', bounds: { x: 1920, y: 0, width: 1920, height: 1080 }, scaleFactor, displayFrequency: 75 };
  const screen = { getDisplayMatching: () => display, getAllDisplays: () => [display] };
  const win = new EventEmitter(), webContents = new EventEmitter();
  let current = win, revision = 0, captures = 0;
  win.webContents = webContents;
  win.bounds = { x: 1920, y: 0, width: 1280, height: 720 };
  win.isDestroyed = () => !!win.destroyed;
  win.getBounds = () => win.bounds;
  win.getContentSize = () => [win.bounds.width, win.bounds.height];
  win.isFullScreen = () => !!win.fullscreen;
  win.setBounds = bounds => { win.bounds = bounds; win.emit('resize'); win.emit('move'); };
  webContents.getZoomFactor = () => 1;
  let measure = () => ({ width: win.bounds.width, height: win.bounds.height, devicePixelRatio: display.scaleFactor, clipped: false });
  webContents.executeJavaScript = async script => { assert.equal(script, MEASURE_RENDERER); return measure(); };
  let capture = async () => ({ getScaleFactors: () => [1, display.scaleFactor], toPNG: () => png(win.bounds.width * display.scaleFactor, win.bounds.height * display.scaleFactor) });
  webContents.capturePage = () => { captures++; return capture(); };
  const options = { screen, getWindow: () => current, getRevision: () => revision, timeoutMs: 30 };
  const read = createQualityReader(options);
  return { win, webContents, screen, read, options, captures: () => captures,
    setDisplay: value => { display = value; }, display: () => display,
    setWindow: value => { current = value; }, bumpRevision: () => { revision++; },
    setMeasure: value => { measure = value; }, setCapture: value => { capture = value; } };
}

for (const density of [1, 1.25, 2]) test(`quality separates logical dimensions from observed ${density}× raster`, async () => {
  const f = fixture(density), result = await f.read();
  assert.equal(result.ok, true);
  assert.equal(result.role, 'primary');
  assert.equal(result.geometry.width, 1280);
  assert.equal(result.geometry.height, 720);
  assert.equal(result.geometry.displayWidth, 1920);
  assert.equal(result.geometry.displayHeight, 1080);
  assert.equal(result.geometry.displayLabel, 'Stage TV');
  assert.equal(result.geometry.refreshRate, 75);
  assert.equal(result.geometry.scaleFactor, density);
  assert.equal(result.geometry.pixelWidth, 1280 * density);
  assert.equal(result.geometry.pixelHeight, 720 * density);
  assert.deepEqual(result.renderer, { width: 1280, height: 720, devicePixelRatio: density, zoomFactor: 1 });
  assert.deepEqual(result.capture, { width: 1280 * density, height: 720 * density });
  assert.equal(result.captureStatus, 'verified');
  assert.equal(result.clipped, false);
  assert.equal(f.win.listenerCount('resize'), 0);
  assert.equal(f.webContents.listenerCount('zoom-changed'), 0);
});

test('geometry tracks the actual display after a drag, with no native panel claim', () => {
  const f = fixture();
  f.setDisplay({ id: 3, label: 'Retina', bounds: { x: -2000, y: 0, width: 1512, height: 982 }, scaleFactor: 2 });
  const geometry = outputGeometry(f.win, f.screen);
  assert.equal(geometry.displayId, 3);
  assert.equal(geometry.displayLabel, 'Retina');
  assert.equal(geometry.refreshRate, null);
  assert.equal(geometry.pixelWidth, 2560);
  assert.equal(displayInfo(f.display()).pixelWidth, 3024);
  assert.equal(Object.hasOwn(geometry, 'nativeResolution'), false);
});

test('closed outputs and invalid roles are read-only and never capture or create a window', async () => {
  const f = fixture(); f.setWindow(null);
  assert.deepEqual(await f.read(), { ok: false, code: 'OUTPUT_CLOSED' });
  assert.deepEqual(await f.read('secondary'), { ok: false, code: 'OUTPUT_CLOSED' });
  for (const role of ['other', null, {}, 1]) assert.deepEqual(await f.read(role), { ok: false, code: 'INVALID_ROLE' });
  assert.equal(f.captures(), 0);
});

test('8K and dense viewports report dimensions without allocating large captures', async () => {
  const f = fixture(2); f.win.bounds = { x: 0, y: 0, width: 7680, height: 4320 };
  const result = await f.read();
  assert.equal(result.ok, true); assert.equal(result.captureStatus, 'too-large');
  assert.equal(result.capture, null); assert.equal(f.captures(), 0);
  assert.ok(result.geometry.pixelWidth * result.geometry.pixelHeight > MAX_CAPTURE_PIXELS);
});

test('zoom changes CSS viewport dimensions without changing physical capture dimensions', async () => {
  const f = fixture(2);
  f.webContents.getZoomFactor = () => 1.25;
  f.setMeasure(() => ({ width: 1024, height: 576, devicePixelRatio: 2.5, clipped: false }));
  const result = await f.read();
  assert.equal(result.renderer.zoomFactor, 1.25);
  assert.deepEqual(result.capture, { width: 2560, height: 1440 });
});

test('capture errors and empty images keep geometry useful without claiming a verified raster', async () => {
  for (const capture of [() => Promise.reject(new Error('capture unavailable')), async () => ({toPNG: () => Buffer.alloc(0)})]) {
    const f = fixture(); f.setCapture(capture);
    const result = await f.read();
    assert.equal(result.ok, true); assert.equal(result.captureStatus, 'unavailable'); assert.equal(result.capture, null);
  }
});

test('capture timeout prevents repeated checks from queuing new uncancellable captures', async () => {
  const f = fixture(); let finish;
  f.setCapture(() => new Promise(resolve => { finish = resolve; }));
  assert.equal((await f.read()).captureStatus, 'unavailable');
  assert.equal((await f.read()).captureStatus, 'unavailable');
  assert.equal(f.captures(), 1);
  finish({toPNG: () => png(1280,720)});
  await new Promise(resolve => setImmediate(resolve));
  f.setCapture(async () => ({toPNG: () => png(1280,720)}));
  assert.equal((await f.read()).captureStatus, 'verified');
  assert.equal(f.captures(), 2);
});

test('closing, replacing, moving, resizing, or rerouting during a capture invalidates the result', async () => {
  const changes = [
    { action: f => { f.win.destroyed = true; f.setWindow(null); }, code: 'OUTPUT_CLOSED' },
    { action: f => f.setWindow(fixture().win), code: 'OUTPUT_CHANGED' },
    { action: f => f.win.emit('move'), code: 'OUTPUT_CHANGED' },
    { action: f => { f.win.bounds.width = 960; }, code: 'OUTPUT_CHANGED' },
    { action: f => f.bumpRevision(), code: 'OUTPUT_CHANGED' },
    { action: f => f.webContents.emit('zoom-changed'), code: 'OUTPUT_CHANGED' }
  ];
  for (const {action, code} of changes) {
    const f = fixture();
    f.setCapture(async () => { action(f); return {toPNG: () => png(1280,720)}; });
    const result = await f.read();
    assert.deepEqual(result, { ok: false, code });
    assert.equal(f.win.listenerCount('move'), 0);
  }
});

test('a renderer-only DPR or viewport change during capture is rejected', async () => {
  for (const change of [{devicePixelRatio: 2}, {width: 1279}]) {
    const f = fixture();
    f.setCapture(async () => {
      f.setMeasure(() => ({width:1280,height:720,devicePixelRatio:1,clipped:false,...change}));
      return {toPNG: () => png(1280,720)};
    });
    assert.deepEqual(await f.read(), {ok:false,code:'OUTPUT_CHANGED'});
  }
});

test('unresponsive or invalid renderers return bounded failures and remove observers', async () => {
  for (const measure of [() => new Promise(() => {}), () => ({width:0,height:720,devicePixelRatio:1,clipped:false})]) {
    const f = fixture(); f.setMeasure(measure);
    assert.deepEqual(await f.read(), {ok:false,code:'OUTPUT_UNAVAILABLE'});
    assert.equal(f.captures(), 0); assert.equal(f.win.listenerCount('resize'), 0);
  }
});

test('PNG dimensions are read from encoded bytes, not a logical native image size', () => {
  assert.deepEqual(pngDimensions(png(3840,2160)), {width:3840,height:2160});
  for (const bytes of [null, Buffer.alloc(24), png(0,720), Buffer.alloc(8)]) assert.equal(pngDimensions(bytes), null);
});

test('display metrics reflow only the affected windowed grid and never fullscreen/custom outputs', () => {
  const f = fixture(), other = fixture(); other.win.bounds.x = -1920;
  const display = { ...f.display(), bounds: {x:1920,y:0,width:2560,height:1440} };
  let revisions = 0;
  const options = {win:f.win,display,metrics:['bounds'],state:{gridOn:true,gridSize:3,gridCell:8},targetId:2,beforeMove:()=>revisions++};
  assert.equal(reflowGridForDisplay({...options,win:other.win,targetId:3}), false);
  assert.equal(reflowGridForDisplay({...options,state:{gridOn:false}}), false);
  assert.equal(reflowGridForDisplay({...options,placing:true}), false);
  assert.equal(reflowGridForDisplay({...options,metrics:['displayFrequency']}), false);
  f.win.fullscreen = true;
  assert.equal(reflowGridForDisplay(options), false);
  f.win.fullscreen = false;
  assert.equal(reflowGridForDisplay(options), true);
  assert.deepEqual(f.win.bounds, {x:3626,y:960,width:853,height:480});
  assert.equal(revisions, 1);
  assert.equal(reflowGridForDisplay(options), false);
  assert.equal(revisions, 1);
  assert.deepEqual(other.win.bounds, {x:-1920,y:0,width:1280,height:720});
});

test('fixed renderer query reports pane clipping without mutating the document or reading text', async () => {
  const paneRect = {left:0,top:0,right:640,bottom:720,width:640,height:720};
  let timerRect = {left:20,top:100,right:620,bottom:500,width:600,height:400};
  const pane = {getBoundingClientRect:()=>paneRect};
  const timer = {parentElement:null,getBoundingClientRect:()=>timerRect,closest:()=>pane};
  Object.defineProperty(timer, 'textContent', {get:()=>{throw new Error('must not read text');}});
  const context = {innerWidth:1280,innerHeight:720,devicePixelRatio:2,setTimeout,clearTimeout,
    document:{fonts:{ready:Promise.resolve()},getElementById:id=>id==='timer'?timer:null},
    getComputedStyle:()=>({display:'block',visibility:'visible'}),requestAnimationFrame:fn=>setImmediate(fn)};
  assert.equal((await vm.runInNewContext(MEASURE_RENDERER, context)).clipped, false);
  timerRect = {...timerRect,right:660,width:640};
  assert.equal((await vm.runInNewContext(MEASURE_RENDERER, context)).clipped, true);
});
