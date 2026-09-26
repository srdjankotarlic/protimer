'use strict';
// Electron-only optional integration services. No timer engine lives here.
const { app, ipcMain, shell, dialog, globalShortcut } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Layout = require('./deck-layout');
const { createBridge } = require('./deck-bridge');
const UUID = 'com.srdjankotarlic.protimer';
module.exports = function createDeckHost({ getControl, outputCommand, smoke = false }) {
  const file = path.join(app.getPath('userData'), 'stream-deck.json');
  const settings = { schemaVersion: 1, enabled: false, selectedDeviceId: '', layout: Layout.defaultLayout(), layoutRevision: 1, savedLayouts: [],
    audio: { volume: 0.6, sinkId: 'default', sound: 'builtin', name: 'ProTimer bell' }, globalHotkeys: false };
  try { const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (saved.schemaVersion === 1) {
      settings.layout = Layout.migrate(saved.layout); settings.enabled = saved.enabled === true;
      settings.selectedDeviceId = typeof saved.selectedDeviceId === 'string' ? saved.selectedDeviceId.slice(0, 128) : '';
      settings.savedLayouts = (Array.isArray(saved.savedLayouts) ? saved.savedLayouts : []).slice(0, 50).flatMap(v => { try { const layout=Layout.migrate(v.layout||v); return [{id:typeof v.id==='string'?v.id:crypto.randomUUID(),name:layout.name,layout}]; } catch (_) { return []; } });
      if (saved.drafts?.schemaVersion === 1) settings.drafts = saved.drafts;
      if (saved.audio && Number.isFinite(saved.audio.volume)) settings.audio = { ...settings.audio, volume: Math.max(0, Math.min(1, saved.audio.volume)), sinkId: String(saved.audio.sinkId || 'default').slice(0, 500), sound: saved.audio.sound === 'file' ? 'file' : 'builtin', name: String(saved.audio.name || 'ProTimer bell').slice(0, 120) };
      if (typeof saved.audioFile === 'string') settings.audioFile = saved.audioFile;
      // Global shortcuts must be deliberately enabled again after a relaunch.
    }
  } catch (_) { /* Missing/corrupt integration settings never break ProTimer. */ }
  if (smoke) settings.enabled = false;
  let softwareDetected = false, bootstrapAt = 0, pairing = false, disposed = false;
  let lastFrame = null; const requests = new Map(), registered = new Set();
  function persist() { const temp = `${file}.tmp`; fs.writeFileSync(temp, JSON.stringify(settings, null, 2), { mode: 0o600 }); fs.renameSync(temp, file); }
  function authorized(e) { const win = getControl(); return win && !win.isDestroyed() && e.sender === win.webContents; }
  function renderer(action, payload, context) {
    const win = getControl(); if (!win || win.isDestroyed()) return Promise.resolve({ ok: false, error: 'CONTROL_UNAVAILABLE' });
    const id = crypto.randomUUID();
    return new Promise(resolve => { const timer = setTimeout(() => { requests.delete(id); resolve({ ok: false, error: 'CONTROL_TIMEOUT' }); }, 4000);
      requests.set(id, { resolve, timer }); win.webContents.send('deck-request', { id, action, payload, context, expiresAt: Date.now() + 3500 }); });
  }
  const bridge = createBridge({
    getSnapshot: () => ({ layout: settings.layout, layoutRevision: settings.layoutRevision }),
    onRequest: (type, body, context) => renderer(type, body, context),
    onDisconnect: context => renderer('disconnect', {}, context), onChange: () => push()
  });
  function safeSettings() { const { audioFile, ...safe } = settings; return safe; }
  function snapshot() {
    const b = bridge.status(), devices = b.inventory.devices;
    if (!settings.selectedDeviceId && devices.length === 1) settings.selectedDeviceId = devices[0].id;
    const visible = b.inventory.actions.filter(a => a.deviceId === settings.selectedDeviceId);
    // No supported API for arbitrary active profile. Visible own keys are only
    // evidence, not a claim that a bundled profile is selected.
    const status = !settings.enabled ? 'disabled' : !softwareDetected ? 'no-software' : !b.connected ? pairing ? 'pairing' : 'plugin-missing' : b.pluginVersion !== '0.1.0' ? 'outdated' : b.stale ? 'stale' : !devices.length ? 'no-device' : !visible.length ? 'profile-inactive' : 'connected';
    return { ...safeSettings(), softwareDetected, status, pluginVersion: b.pluginVersion, devices, inventory: b.inventory.actions,
      profile: { active: false, known: false, canReturn: visible.length > 0 }, profilesVerified: false, canActivate: false,
      statusDetail: status === 'profile-inactive' ? 'No visible ProTimer actions on the selected device.' : '',
      audio: { ...settings.audio, available: true } };
  }
  function push() { const win = getControl(); if (win && !win.isDestroyed()) win.webContents.send('deck-status', snapshot()); }
  async function detectSoftware() {
    try { const info = await app.getApplicationInfoForProtocol('streamdeck://'); softwareDetected = !!info?.path; }
    catch (_) { softwareDetected = false; }
    return softwareDetected;
  }
  async function bootstrap() {
    await detectSoftware();
    if (!settings.enabled || !softwareDetected || disposed) { push(); return { ok: false, error: 'STREAM_DECK_SOFTWARE_NOT_FOUND' }; }
    await bridge.start(); const bootstrap = bridge.bootstrap(); bootstrapAt = Date.now(); pairing = true; push();
    const url = new URL(`streamdeck://plugins/message/${UUID}/bootstrap`);
    url.searchParams.set('streamdeck', 'hidden'); url.searchParams.set('port', String(bootstrap.port)); url.searchParams.set('nonce', bootstrap.nonce);
    try { await shell.openExternal(url.toString()); return { ok: true }; }
    catch (_) { pairing = false; push(); return { ok: false, error: 'BOOTSTRAP_FAILED' }; }
  }
  function unregister() { for (const key of registered) globalShortcut.unregister(key); registered.clear(); }
  function configureHotkeys(enabled) {
    unregister(); settings.globalHotkeys = false;
    if (!enabled) return { ok: true };
    const errors = [];
    for (const key of settings.layout.slots.filter(k => k?.hotkey)) {
      // A bare character/Space must never steal typing or PowerPoint transport.
      if (!/^(?:Ctrl|Alt|Meta)\+/.test(key.hotkey) && !/^F\d+$/.test(key.hotkey)) { errors.push(`${key.hotkey}: use Ctrl, Alt or Command for global shortcuts`); continue; }
      const accelerator = key.hotkey.replace('Meta', 'Command').replace('Ctrl', 'Control').replace('Arrow', '');
      try { if (!globalShortcut.register(accelerator, () => renderer('hotkey', { keyId: key.id, global: true }, { sourceId: 'global-hotkey', sessionId: 'local', connected: true }))) errors.push(`${key.hotkey}: unavailable or OS permission required`); else registered.add(accelerator); }
      catch (_) { errors.push(`${key.hotkey}: unsupported by this OS`); }
    }
    if (errors.length) { unregister(); return { ok: false, errors }; }
    settings.globalHotkeys = true; return { ok: true };
  }
  async function invoke(action, payload = {}) {
    if (action === 'status') return { ...snapshot(), drafts: settings.drafts };
    if (action === 'enable' || action === 'setup') {
      settings.enabled = action === 'setup' || payload.enabled === true; persist();
      if (!settings.enabled) { pairing = false; await bridge.close(); push(); return { ok: true }; }
      return bootstrap();
    }
    if (action === 'install') {
      const packageFile = app.isPackaged ? path.join(process.resourcesPath, 'streamdeck', `${UUID}.streamDeckPlugin`) : path.join(__dirname, 'streamdeck-plugin', 'dist', `${UUID}.streamDeckPlugin`);
      if (!fs.existsSync(packageFile)) return { ok: false, error: 'PLUGIN_PACKAGE_NOT_BUILT' };
      const error = await shell.openPath(packageFile); return error ? { ok: false, error: 'PLUGIN_INSTALLER_COULD_NOT_OPEN' } : { ok: true, confirmationRequired: true };
    }
    if (action === 'selectDevice') {
      if (!bridge.status().inventory.devices.some(d => d.id === payload.deviceId)) return { ok: false, error: 'DEVICE_NOT_CONNECTED' };
      const connection=bridge.status();
      if(connection.sessionId&&settings.selectedDeviceId)await renderer('disconnect',{}, {sourceId:'native-deck',sessionId:connection.sessionId,deviceId:settings.selectedDeviceId,connected:false});
      settings.selectedDeviceId = payload.deviceId; persist(); await renderer('resetEditTarget', {}, { sourceId: 'control', sessionId: 'local' }); push(); return { ok: true };
    }
    if (action === 'activate') return { ok: false, error: 'VERIFIED_STARTER_PROFILE_REQUIRED', message: 'This build has no Elgato-exported verified profile. Place ProTimer Key actions in the Elgato editor; do not import an invented profile.' };
    if (action === 'back') {
      if (!snapshot().profile.canReturn) return { ok: false, error: 'PROFILE_OWNERSHIP_UNKNOWN', message: 'Use the BACK ProTimer key on the device. No visible own actions; ProTimer will not take over your profile.' };
      return bridge.instruction('back', { deviceId: settings.selectedDeviceId });
    }
    if (action === 'applyLayout') {
      if (payload.expectedRevision !== undefined && payload.expectedRevision !== settings.layoutRevision) return { ok: false, error: 'LAYOUT_CHANGED', message: 'The applied layout changed. Reopen the editor before applying.' };
      const valid = Layout.validate(payload.layout || payload); if (!valid.ok) return valid;
      // Importing/naming a layout changes commands, not the physical board's
      // identity. Existing owned instance bindings remain attached by slot.
      valid.layout.id=settings.layout.id;
      const previous = settings.layout; settings.layout = valid.layout; settings.layoutRevision++;
      if (settings.globalHotkeys) { const result = configureHotkeys(true); if (!result.ok) { settings.layout = previous; settings.layoutRevision--; configureHotkeys(true); push(); return result; } }
      persist(); push();
      const ack = await bridge.instruction('applyLayout', { layoutRevision: settings.layoutRevision });
      return { ok: true, applied: true, layout: settings.layout, layoutRevision: settings.layoutRevision, deviceConfirmed: ack.ok && ack.deviceConfirmed === true,
        reason: ack.error || 'Only visible ProTimer-owned actions can be updated; unobserved keys are unknown.' };
    }
    if (action === 'bindSlot') {
      const actionInstance = bridge.status().inventory.actions.find(a => a.context === payload.context && a.instanceId === payload.instanceId && a.deviceId === payload.deviceId);
      if (!actionInstance || payload.layoutId !== settings.layout.id || !settings.layout.slots.some(k => k?.id === payload.slotId)) return { ok: false, error: 'OWNED_ACTION_REQUIRED' };
      return bridge.instruction('bind', { context: actionInstance.context, deviceId: actionInstance.deviceId, instanceId: actionInstance.instanceId, layoutId: settings.layout.id, slotId: payload.slotId });
    }
    if (action === 'saveLayout') {
      const valid = Layout.validate(payload.layout || payload); if (!valid.ok) return valid;
      if (settings.savedLayouts.length >= 50) return { ok: false, error: 'LAYOUT_LIMIT' };
      // Named snapshots are distinct from the stable applied logical layout ID.
      // Saving a new name must not overwrite another show or detach bindings.
      settings.savedLayouts.push({id:crypto.randomUUID(),name:valid.layout.name,layout:valid.layout});
      persist(); push(); return { ok: true };
    }
    if (action === 'importLayoutFile') {
      const result = await dialog.showOpenDialog(getControl(), { properties: ['openFile'], filters: [{ name: 'ProTimer layout', extensions: ['json'] }] });
      if (result.canceled) return { ok: false, canceled: true };
      const name = result.filePaths[0]; if (fs.statSync(name).size > 65536) return { ok: false, error: 'LAYOUT_TOO_LARGE' };
      try { return { ok: true, layout: Layout.migrate(JSON.parse(fs.readFileSync(name, 'utf8'))) }; } catch (_) { return { ok: false, error: 'INVALID_LAYOUT_JSON' }; }
    }
    if (action === 'exportLayoutFile') {
      const valid = Layout.validate(payload.layout || settings.layout); if (!valid.ok) return valid;
      const result = await dialog.showSaveDialog(getControl(), { defaultPath: 'ProTimer-layout.json', filters: [{ name: 'ProTimer layout', extensions: ['json'] }] });
      if (result.canceled) return { ok: false, canceled: true };
      fs.writeFileSync(result.filePath, JSON.stringify(valid.layout, null, 2)); return { ok: true };
    }
    if (action === 'configureHotkeys') { const result = configureHotkeys(payload.enabled === true); push(); return result; }
    if (action === 'confirmGlobalCommand') {
      const key = settings.layout.slots.find(k=>k?.id===payload.keyId);
      if (!key || !settings.globalHotkeys) return {ok:false,error:'HOTKEY_DISABLED'};
      const answer=await dialog.showMessageBox(getControl(),{type:'question',buttons:['Cancel','Apply once'],defaultId:0,cancelId:0,title:'ProTimer — Global shortcut',message:`${Layout.label(key)} · ${payload.timerId==='t2'?'T2':'T1'}`,detail:'The OS does not supply a reliable key release for global shortcuts. Confirm this command explicitly. The active timer keeps running.'});
      return {ok:answer.response===1};
    }
    if (action === 'audioConfigure') {
      const a = payload.audio || payload;
      if (!Number.isFinite(a.volume) || a.volume < 0 || a.volume > 1 || typeof a.sinkId !== 'string' || a.sinkId.length > 500 || !['builtin', 'file'].includes(a.sound)) return { ok: false, error: 'INVALID_AUDIO' };
      settings.audio = { ...settings.audio, volume: a.volume, sinkId: a.sinkId, sound: a.sound }; persist(); push(); return { ok: true, audio: settings.audio };
    }
    if (action === 'audioChooseFile') {
      const result = await dialog.showOpenDialog(getControl(), { properties: ['openFile'], filters: [{ name: 'Bell audio', extensions: ['wav', 'mp3', 'ogg'] }] });
      if (result.canceled) return { ok: false, canceled: true };
      const selected = result.filePaths[0]; if (fs.statSync(selected).size > 10 * 1024 * 1024) return { ok: false, error: 'AUDIO_TOO_LARGE' };
      settings.audioFile = selected; settings.audio.sound = 'file'; settings.audio.name = path.basename(selected); persist(); push(); return { ok: true, audio: settings.audio };
    }
    if (action === 'audioData') {
      if (settings.audio.sound !== 'file' || !settings.audioFile || !fs.existsSync(settings.audioFile) || fs.statSync(settings.audioFile).size > 10 * 1024 * 1024) return { ok: false, error: 'AUDIO_FILE_UNAVAILABLE' };
      return { ok: true, bytes: [...fs.readFileSync(settings.audioFile)] };
    }
    if (action === 'output') return outputCommand(payload);
    return { ok: false, error: 'UNKNOWN_INTEGRATION_ACTION' };
  }
  ipcMain.handle('deck-invoke', async (e, action, payload) => { if (!authorized(e)) return { ok: false, error: 'CONTROL_ONLY' }; try { return await invoke(action, payload); } catch (_) { return { ok: false, error: 'INTEGRATION_OPERATION_FAILED' }; } });
  ipcMain.on('deck-reply', (e, value) => { if (!authorized(e)) return; const item = requests.get(value?.id); if (item) { requests.delete(value.id); clearTimeout(item.timer); item.resolve(value.result); } });
  ipcMain.on('deck-frame', (e, value) => { if (!authorized(e) || !value || typeof value !== 'object') return; lastFrame = value; bridge.update(value); });
  ipcMain.on('deck-drafts', (e, value) => { if (!authorized(e) || value?.schemaVersion !== 1) return; const copy = { schemaVersion: 1, drafts: {} }; for (const id of ['t1', 't2']) { const d = value.drafts?.[id]; if (!d || !['countdown', 'countup', 'clock'].includes(d.mode) || !Number.isInteger(d.durationMs) || d.durationMs < 0 || d.durationMs > Layout.MAX_DURATION) return; copy.drafts[id] = { mode: d.mode, durationMs: d.durationMs }; } settings.drafts = copy; persist(); });
  const maintenance = setInterval(() => { if (settings.enabled && !bridge.status().connected && Date.now() - bootstrapAt > 15000 && !smoke) bootstrap().catch(() => {}); push(); }, 1000);
  maintenance.unref();
  detectSoftware().then(push);
  if (settings.enabled && !smoke) bootstrap().catch(() => {});
  return { snapshot, bridge, invoke, close() { disposed = true; clearInterval(maintenance); unregister(); bridge.close(); for (const item of requests.values()) { clearTimeout(item.timer); item.resolve({ ok: false, error: 'APP_CLOSED' }); } requests.clear(); } };
};
