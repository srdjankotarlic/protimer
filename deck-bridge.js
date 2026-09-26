'use strict';
// Optional native-plugin transport. Deliberately separate from the existing LAN
// HTTP/OSC API: no CORS, loopback only, one-use bootstrap, memory-only credentials.
const http = require('node:http');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const PROTOCOL_VERSION = 1;
const MAX_BODY = 64 * 1024;
const secret = () => crypto.randomBytes(32).toString('base64url');
function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function cleanInventory(value) {
  if (!plain(value) || !Array.isArray(value.devices) || !Array.isArray(value.actions) || value.devices.length > 16 || value.actions.length > 512) throw new Error('INVALID_INVENTORY');
  const string = (s, max = 128) => typeof s === 'string' && s.length <= max ? s : '';
  const devices = value.devices.map(d => ({ id: string(d.id), name: string(d.name), type: typeof d.type === 'number' ? d.type : string(d.type) })).filter(d => d.id);
  const actions = value.actions.map(a => ({ context: string(a.context), deviceId: string(a.deviceId), instanceId: string(a.instanceId),
    layoutId: string(a.layoutId), slotId: string(a.slotId), slotIndex: Number.isInteger(a.slotIndex) && a.slotIndex >= 0 && a.slotIndex < 32 ? a.slotIndex : undefined, row: Number.isInteger(a.row) ? a.row : -1, column: Number.isInteger(a.column) ? a.column : -1,
    command: string(a.command), visible: true })).filter(a => a.context && devices.some(d => d.id === a.deviceId) && a.row >= 0 && a.row < 16 && a.column >= 0 && a.column < 16);
  if (new Set(devices.map(d=>d.id)).size!==devices.length || new Set(actions.map(a=>a.context)).size!==actions.length || new Set(actions.filter(a=>a.instanceId).map(a=>a.instanceId)).size!==actions.filter(a=>a.instanceId).length) throw new Error('INVALID_INVENTORY');
  // Presence proves only that these actions are visible. Missing coordinates
  // are UNKNOWN, never evidence that a foreign button is free.
  return { devices, actions, softwareVersion: string(value.softwareVersion,40) };
}
function createBridge({ getSnapshot, onRequest, onDisconnect = () => {}, onChange = () => {}, now = () => performance.now(), staleMs = 2500 } = {}) {
  let server = null, port = 0, nonce = null, nonceUntil = 0, session = null, heartbeat = null;
  let frame = null, frameAt = -Infinity, sequence = 0, inventory = { devices: [], actions: [] };
  const pending = new Map();
  function disconnect(reason) {
    const previous = session;
    session = null; inventory = { devices: [], actions: [] };
    for (const item of pending.values()) { clearTimeout(item.timeout); item.resolve({ ok: false, error: reason }); }
    pending.clear();
    if (previous) onDisconnect({ sourceId: 'native-deck', sessionId: previous.id, connected: false });
    onChange();
  }
  function connected() { return !!session && now() - session.lastSeen <= staleMs; }
  function status() { return { connected: connected(), stale: now() - frameAt > staleMs, pluginVersion: session?.pluginVersion || null, sessionId: session?.id || null, inventory }; }
  function context(body) {
    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId : '';
    if (!inventory.devices.some(d => d.id === deviceId)) throw new Error('DEVICE_NOT_CONNECTED');
    return { sourceId: 'native-deck', sessionId: session.id, deviceId, connected: true };
  }
  function write(res, code, value) {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(value));
  }
  async function bodyOf(req) {
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new Error('JSON_REQUIRED');
    let data = '', bytes = 0;
    for await (const chunk of req) { bytes += chunk.length; if (bytes > MAX_BODY) throw new Error('BODY_TOO_LARGE'); data += chunk; }
    const body = JSON.parse(data || '{}');
    if (!plain(body)) throw new Error('INVALID_BODY');
    return body;
  }
  async function handle(req, res) {
    try {
      if (req.headers.host !== `127.0.0.1:${port}` || req.headers.origin || !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return write(res, 403, { ok: false, error: 'LOCAL_NATIVE_CLIENT_REQUIRED' });
      if (req.url === '/pair' && req.method === 'POST') {
        const body = await bodyOf(req);
        if (body.protocolVersion !== PROTOCOL_VERSION) return write(res, 426, { ok: false, error: 'PROTOCOL_MISMATCH' });
        if (typeof body.pluginVersion !== 'string' || body.pluginVersion.length > 40 || !nonce || now() > nonceUntil || !equal(body.nonce, nonce)) return write(res, 401, { ok: false, error: 'BOOTSTRAP_EXPIRED' });
        nonce = null; disconnect('SESSION_REPLACED');
        session = { id: secret(), token: secret(), pluginVersion: body.pluginVersion, lastSeen: now(), rateAt: now(), requests: 0 };
        onDisconnect({ sourceId: 'native-deck', sessionId: session.id, connected: false });
        onChange();
        return write(res, 200, { ok: true, token: session.token, sessionId: session.id, protocolVersion: PROTOCOL_VERSION });
      }
      if (!connected() || !equal(req.headers.authorization, `Bearer ${session?.token}`)) return write(res, 401, { ok: false, error: 'PAIRING_REQUIRED' });
      const authorizedSession = session;
      if (now() - session.rateAt > 1000) { session.rateAt = now(); session.requests = 0; }
      if (++session.requests > 80) return write(res, 429, { ok: false, error: 'RATE_LIMIT' });
      session.lastSeen = now();
      if (req.url === '/state' && req.method === 'GET') {
        const extra = getSnapshot?.() || {};
        return write(res, 200, { ...extra, sessionId: session.id, protocolVersion: PROTOCOL_VERSION, sequence,
          stale: now() - frameAt > staleMs, state: frame, instructions: [...pending.values()].map(i => i.instruction) });
      }
      if (req.method !== 'POST') return write(res, 404, { ok: false, error: 'NOT_FOUND' });
      const body = await bodyOf(req);
      if (session !== authorizedSession || !connected()) return write(res, 401, { ok: false, error: 'PAIRING_REQUIRED' });
      if (req.url === '/inventory') {
        const next = cleanInventory(body);
        for (const device of inventory.devices) if (!next.devices.some(d => d.id === device.id)) onDisconnect({ sourceId: 'native-deck', sessionId: session.id, deviceId: device.id, connected: false });
        inventory = next; onChange(); return write(res, 200, { ok: true });
      }
      if (req.url === '/result') {
        const item = pending.get(body.id);
        if (item) {
          pending.delete(body.id); clearTimeout(item.timeout);
          const versionMatches=item.instruction.type!=='applyLayout'||body.layoutRevision===item.instruction.layoutRevision;
          item.resolve({ ok: body.ok === true&&versionMatches, error: !versionMatches?'LAYOUT_REVISION_MISMATCH':typeof body.error === 'string' ? body.error.slice(0, 200) : undefined, deviceConfirmed: versionMatches&&body.deviceConfirmed === true,
            layoutRevision:Number.isInteger(body.layoutRevision)?body.layoutRevision:undefined,status:typeof body.status==='string'?body.status.slice(0,100):undefined });
        }
        return write(res, 200, { ok: true });
      }
      if (!['/command', '/press', '/release'].includes(req.url)) return write(res, 404, { ok: false, error: 'NOT_FOUND' });
      if (now() - frameAt > staleMs) return write(res, 409, { ok: false, error: 'AUTHORITATIVE_STATE_STALE' });
      const result = await onRequest(req.url.slice(1), body, context(body));
      return write(res, 200, result || { ok: false, error: 'NO_APPLIED_RESULT' });
    } catch (error) {
      // Never echo request bodies or credentials in diagnostics.
      const allowed = ['DEVICE_NOT_CONNECTED', 'INVALID_INVENTORY', 'BODY_TOO_LARGE', 'JSON_REQUIRED', 'INVALID_BODY'];
      write(res, 400, { ok: false, error: allowed.includes(error.message) ? error.message : 'INVALID_REQUEST' });
    }
  }
  return {
    status,
    update(value) { frame = value; frameAt = now(); sequence++; },
    async start() {
      if (server) return port;
      server = http.createServer(handle);
      server.requestTimeout = 5000; server.headersTimeout = 5000;
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      port = server.address().port;
      heartbeat = setInterval(() => { if (session && !connected()) disconnect('DISCONNECTED'); }, 500);
      heartbeat.unref?.(); return port;
    },
    bootstrap() { if (!server) throw new Error('BRIDGE_DISABLED'); nonce = secret(); nonceUntil = now() + 30000; return { port, nonce, protocolVersion: PROTOCOL_VERSION }; },
    instruction(type, payload = {}) {
      if (!connected()) return Promise.resolve({ ok: false, error: 'PLUGIN_OFFLINE' });
      if (pending.size >= 8) return Promise.resolve({ ok: false, error: 'BUSY' });
      const id = crypto.randomUUID();
      return new Promise(resolve => { const timeout = setTimeout(() => { pending.delete(id); resolve({ ok: false, error: 'DEVICE_CONFIRMATION_TIMEOUT' }); }, 8000);
        pending.set(id, { instruction: { id, type, ...payload }, resolve, timeout }); });
    },
    async close() { clearInterval(heartbeat); nonce = null; disconnect('DISABLED'); const old = server; server = null; port = 0; if (old) { old.closeAllConnections(); await new Promise(resolve => old.close(resolve)); } }
  };
}
module.exports = { createBridge, cleanInventory, PROTOCOL_VERSION };
