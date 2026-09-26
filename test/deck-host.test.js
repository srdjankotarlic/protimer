const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Module = require('node:module');
const path = require('node:path');
const Layout = require('../deck-layout');

function hostHarness(t, saved) {
  const files = new Map(), handles = new Map(), events = new Map(), sent = [], outputs = [], registered = new Map(), dialogs = [];
  let dialogResponse = 0;
  const settingsPath = path.join('/isolated-test', 'stream-deck.json');
  if (saved) files.set(settingsPath, JSON.stringify(saved));
  const fileSystem = { readFileSync(file) { if (!files.has(file)) throw Error('ENOENT'); return files.get(file); },
    writeFileSync: (file, contents) => files.set(file, contents), renameSync: (old, file) => { files.set(file, files.get(old)); files.delete(old); },
    existsSync: file => files.has(file), statSync: file => ({ size: Buffer.byteLength(files.get(file) || '') }) };
  const webContents = { send: (channel, value) => sent.push({ channel, value }) }, control = { isDestroyed: () => false, webContents };
  const electron = {
    app: { getPath: () => '/isolated-test', isPackaged: false, getApplicationInfoForProtocol: async () => { throw Error('Not installed'); } },
    ipcMain: { handle: (name, handler) => handles.set(name, handler), on: (name, handler) => events.set(name, handler) },
    shell: { openPath: async () => '', openExternal: async () => {} },
    dialog: { showOpenDialog: async () => ({ canceled: true }), showSaveDialog: async () => ({ canceled: true }),
      showMessageBox: async (_window, options) => { dialogs.push(options); return { response: dialogResponse }; } },
    globalShortcut: { register: (key, callback) => { registered.set(key, callback); return true; }, unregister: key => registered.delete(key) }
  };
  const filename = require.resolve('../deck-host'), wrapper = vm.runInThisContext(Module.wrap(fs.readFileSync(filename, 'utf8')), { filename });
  const module = { exports: {} }, localRequire = name => name === 'electron' ? electron : name === 'node:fs' ? fileSystem : name.startsWith('./') ? require(path.resolve(path.dirname(filename), name)) : require(name);
  wrapper(module.exports, localRequire, module, filename, path.dirname(filename));
  const host = module.exports({ getControl: () => control, outputCommand: value => { outputs.push(value); return { ok: true }; }, smoke: true });
  t.after(() => host.close());
  return { host, files, settingsPath, events, handles, outputs, registered, sent, control, dialogs, setDialogResponse(value) { dialogResponse = value; },
    invoke: (action, payload, sender = webContents) => handles.get('deck-invoke')({ sender }, action, payload),
    emit: (name, value, sender = webContents) => events.get(name)({ sender }, value) };
}

test('named layout saves preserve two names with the same logical layout id and survive reload', async t => {
  const h = hostHarness(t), layout = Layout.defaultLayout(); layout.name = 'Show A';
  assert.equal((await h.invoke('saveLayout', { layout })).ok, true);
  layout.name = 'Show B'; layout.slots[0].name = 'BEGIN';
  assert.equal((await h.invoke('saveLayout', { layout })).ok, true);
  const saved = h.host.snapshot().savedLayouts;
  assert.equal(saved.length, 2); assert.notEqual(saved[0].id, saved[1].id);
  assert.equal(saved[0].layout.id, saved[1].layout.id); assert.equal(saved[0].name, 'Show A'); assert.equal(saved[1].name, 'Show B');
  assert.equal(saved[0].layout.slots[0].name, '');
  const reloaded = hostHarness(t, JSON.parse(h.files.get(h.settingsPath))).host.snapshot().savedLayouts;
  assert.deepEqual(reloaded, saved);
});

test('default restore and applying a layout do not erase named snapshots or modify ACTIVE', async t => {
  const h = hostHarness(t), layout = Layout.defaultLayout(); layout.name = 'Saved Show';
  await h.invoke('saveLayout', { layout });
  const result = await h.invoke('applyLayout', { layout: Layout.defaultLayout('full'), expectedRevision: 1 });
  assert.equal(result.ok, true); assert.equal(result.deviceConfirmed, false);
  assert.equal(result.layout.id,layout.id,'Changing template preserves the linked physical board identity');
  assert.equal(h.host.snapshot().savedLayouts.length, 1); assert.equal(h.outputs.length, 0);
  assert.equal(h.sent.some(value => value.channel === 'deck-request' && value.value.action === 'command'), false);
  assert.equal((await h.invoke('applyLayout', { layout, expectedRevision: 1 })).error, 'LAYOUT_CHANGED');
});

test('only Control webContents may invoke integration IPC, report state or persist drafts', async t => {
  const h = hostHarness(t), foreign = { id: 'audience-output' };
  assert.equal((await h.invoke('output', { role: 'primary', action: 'open' }, foreign)).error, 'CONTROL_ONLY');
  assert.equal((await h.invoke('audioData', {}, foreign)).error, 'CONTROL_ONLY');
  assert.equal((await h.invoke('saveLayout', { layout: Layout.defaultLayout() }, foreign)).error, 'CONTROL_ONLY');
  assert.equal(h.outputs.length, 0); assert.equal(h.files.size, 0);
  h.emit('deck-frame', { token: 'foreign-state' }, foreign); assert.equal(h.host.bridge.status().stale, true);
  h.emit('deck-drafts', { schemaVersion: 1, drafts: { t1: { mode: 'clock', durationMs: 0 }, t2: { mode: 'countdown', durationMs: 1000 } } }, foreign);
  assert.equal(h.files.size, 0);
  h.emit('deck-drafts', { schemaVersion: 1, drafts: { t1: { mode: 'clock', durationMs: 0 }, t2: { mode: 'countdown', durationMs: 1000 } } });
  assert.equal(JSON.parse(h.files.get(h.settingsPath)).drafts.drafts.t1.mode, 'clock');
});

test('global shortcuts are opt-in and a bare Space cannot steal another application', async t => {
  const layout = Layout.defaultLayout(); layout.slots[0].hotkey = 'Space';
  const h = hostHarness(t, { schemaVersion: 1, layout, enabled: false, savedLayouts: [], globalHotkeys: true });
  assert.equal(h.host.snapshot().globalHotkeys, false); assert.equal(h.registered.size, 0);
  const result = await h.invoke('configureHotkeys', { enabled: true });
  assert.equal(result.ok, false); assert.equal(h.registered.size, 0);
});

test('native global confirmation defaults to Cancel and does not itself execute a timer operation', async t => {
  const layout = Layout.defaultLayout(); layout.slots[5].hotkey = 'Ctrl+R';
  const h = hostHarness(t, { schemaVersion: 1, layout, enabled: false, savedLayouts: [] });
  assert.equal((await h.invoke('confirmGlobalCommand', { keyId: layout.slots[5].id, timerId: 't1' })).error, 'HOTKEY_DISABLED');
  assert.equal((await h.invoke('configureHotkeys', { enabled: true })).ok, true);
  assert.equal((await h.invoke('confirmGlobalCommand', { keyId: layout.slots[5].id, timerId: 't1' })).ok, false);
  assert.equal(h.dialogs[0].defaultId, 0); assert.equal(h.dialogs[0].cancelId, 0);
  h.setDialogResponse(1);
  assert.equal((await h.invoke('confirmGlobalCommand', { keyId: layout.slots[5].id, timerId: 't1' })).ok, true);
  assert.equal(h.outputs.length, 0);
  assert.equal(h.sent.some(value => value.channel === 'deck-request' && value.value.action === 'command'), false);
});

test('missing software or unverified profiles report real blockers without fake activation', async t => {
  const h = hostHarness(t);
  const result = await h.invoke('setup'); assert.equal(result.ok, false); assert.equal(result.error, 'STREAM_DECK_SOFTWARE_NOT_FOUND');
  assert.equal(h.host.snapshot().canActivate, false);
  assert.equal((await h.invoke('activate')).error, 'VERIFIED_STARTER_PROFILE_REQUIRED');
  assert.equal(h.outputs.length, 0);
});

test('layout import/save validator refuses tokens and active code through authorized UI too', async t => {
  const h = hostHarness(t), layout = Layout.defaultLayout(); layout.token = 'secret';
  assert.equal((await h.invoke('saveLayout', { layout })).ok, false); assert.equal(h.files.size, 0);
  delete layout.token; layout.slots[0].command = 'eval';
  assert.equal((await h.invoke('applyLayout', { layout })).ok, false); assert.equal(h.host.snapshot().layoutRevision, 1);
});
