const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createBridge, cleanInventory } = require('../deck-bridge');
const Model = require('../deck-model');

function request(port, path, body, { token, headers = {}, method = body === undefined ? 'GET' : 'POST' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', chunk => { text += chunk; });
      res.on('end', () => { let json; try { json = JSON.parse(text); } catch (_) { json = null; } resolve({ status: res.statusCode, headers: res.headers, body: json, text }); });
    });
    req.on('error', reject); req.end(body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body));
  });
}
async function fixture(t, options = {}) {
  let now = 0;
  const calls = [], disconnects = [], clock = { mode: 'countdown', durationMs: 600000, remMs: 600000, running: false, enabled: true };
  const model = Model.create({ readActive: () => clock, guardNow: () => now, now: () => 100000 + now,
    applyOperation: op => { calls.push(op); if (op.type === 'start') { clock.running = true; clock.endAt = 700000 + now; } return { ok: true }; } });
  const bridge = createBridge({ now: () => now, getSnapshot: () => ({ layout: { id: 'test' }, layoutRevision: 1 }),
    onRequest: (type, body, context) => {
      if (type === 'press') return model.beginPress(body.command, context);
      if (type === 'release') return model.cancelPress(body.pressId, context);
      const { deviceId, ...command } = body; return model.dispatch(command, context);
    }, onDisconnect: context => { disconnects.push(context); model.disconnect(context); }, ...options });
  const port = await bridge.start(); t.after(() => bridge.close());
  const pair = async () => {
    const bootstrap = bridge.bootstrap();
    const result = await request(port, '/pair', { nonce: bootstrap.nonce, pluginVersion: '0.1.0', protocolVersion: 1 });
    assert.equal(result.status, 200); return { ...result.body, nonce: bootstrap.nonce };
  };
  const session = await pair(); bridge.update(model.snapshot());
  const inventory = { devices: [{ id: 'xl-1', name: 'Stream Deck XL', type: 2, size: { rows: 4, columns: 8 } }],
    actions: [{ context: 'action-a', instanceId: 'instance-a', deviceId: 'xl-1', row: 0, column: 0, slotId: 'slot-a' }] };
  assert.equal((await request(port, '/inventory', inventory, session)).status, 200);
  return { bridge, model, port, session, pair, calls, disconnects, inventory,
    advance(ms) { now += ms; }, refresh() { bridge.update(model.snapshot()); },
    command(commandId, type = 'start', extra = {}) { return request(port, '/command', { commandId, type, timerId: 't1', deviceId: 'xl-1', ...extra }, session); } };
}

test('real bridge binds only loopback, requires native Host/Origin and bearer authentication', async t => {
  const h = await fixture(t);
  assert.equal((await request(h.port, '/state')).status, 401);
  assert.equal((await request(h.port, '/state', undefined, { token: 'invalid' })).status, 401);
  assert.equal((await request(h.port, '/state', undefined, { ...h.session, headers: { Origin: 'https://attacker.example' } })).status, 403);
  assert.equal((await request(h.port, '/state', undefined, { ...h.session, headers: { Origin: 'null' } })).status, 403);
  assert.equal((await request(h.port, '/state', undefined, { ...h.session, headers: { Host: `attacker.example:${h.port}` } })).status, 403);
  assert.equal((await request(h.port, '/state', undefined, { ...h.session, headers: { Host: `localhost:${h.port}` } })).status, 403);
  const state = await request(h.port, '/state', undefined, h.session);
  assert.equal(state.status, 200); assert.equal(state.body.state.timers.t1.active.status, 'READY');
  assert.equal(state.headers['cache-control'], 'no-store'); assert.equal(state.headers['access-control-allow-origin'], undefined);
  assert.ok(!state.text.includes(h.session.token)); assert.ok(!state.text.includes(h.session.nonce));
});

test('bootstrap is short lived, one use, protocol checked, and rotates session credentials', async t => {
  const h = await fixture(t);
  assert.equal((await request(h.port, '/pair', { nonce: h.session.nonce, protocolVersion: 1, pluginVersion: '0.1.0' })).status, 401);
  const bootstrap = h.bridge.bootstrap();
  assert.equal((await request(h.port, '/pair', { nonce: bootstrap.nonce, protocolVersion: 2, pluginVersion: '0.1.0' })).status, 426);
  h.advance(30001);
  assert.equal((await request(h.port, '/pair', { nonce: bootstrap.nonce, protocolVersion: 1, pluginVersion: '0.1.0' })).status, 401);
  const next = await h.pair();
  assert.notEqual(next.token, h.session.token); assert.notEqual(next.sessionId, h.session.sessionId);
  assert.equal((await request(h.port, '/state', undefined, h.session)).status, 401);
  assert.ok(h.disconnects.some(context => context.sessionId === h.session.sessionId));
});

test('wire commands receive an applied model ACK, retries are deduplicated and ordered', async t => {
  const h = await fixture(t);
  const a = await h.command('start-once', 'start', { sequence: 4 });
  assert.equal(a.status, 200); assert.equal(a.body.ok, true); assert.equal(a.body.state.timers.t1.active.status, 'RUNNING');
  const b = await h.command('start-once', 'start', { sequence: 4 });
  assert.equal(b.body.ok, true); assert.equal(h.calls.length, 1);
  assert.equal((await h.command('late-command', 'pause', { sequence: 3 })).body.code, 'OUT_OF_ORDER');
  assert.equal((await h.command('start-once', 'pause', { sequence: 5 })).body.code, 'COMMAND_ID_REUSED');
});

test('bridge does not acknowledge before the authoritative operation resolves', async t => {
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; }), arrived = new Promise(resolve => { entered = resolve; });
  const h = await fixture(t, { onRequest: async () => { entered(); await gate; return { ok: true, applied: true }; } });
  let finished = false; const pending = h.command('delayed-ack').then(result => { finished = true; return result; });
  await arrived; assert.equal(finished, false); release();
  assert.equal((await pending).body.applied, true);
});

test('authoritative stale state blocks all timer writes even while plugin heartbeat stays alive', async t => {
  const h = await fixture(t); h.advance(2000);
  await request(h.port, '/state', undefined, h.session); h.advance(501);
  const state = await request(h.port, '/state', undefined, h.session); assert.equal(state.body.stale, true);
  assert.equal((await h.command('stale-start')).status, 409); assert.equal(h.calls.length, 0);
  h.refresh(); assert.equal((await h.command('fresh-start')).body.ok, true);
});

test('new session and USB device inventory prevent old held commands from executing', async t => {
  const h = await fixture(t), command = { commandId: 'reset-held', timerId: 't1', type: 'reset' };
  const hold = await request(h.port, '/press', { command, deviceId: 'xl-1' }, h.session); assert.equal(hold.body.ok, true);
  h.advance(1500);
  await request(h.port, '/inventory', { devices: [], actions: [] }, h.session);
  assert.equal((await h.command('reset-held', 'reset', { pressId: hold.body.pressId })).body.error, 'DEVICE_NOT_CONNECTED');
  const next = await h.pair(); h.refresh();
  await request(h.port, '/inventory', h.inventory, next);
  const replay = await request(h.port, '/command', { ...command, deviceId: 'xl-1', pressId: hold.body.pressId }, next);
  assert.equal(replay.body.code, 'HOLD_REQUIRED'); assert.equal(h.calls.length, 0);
});

test('request bodies, parsing and inventory are bounded without leaking credentials', async t => {
  const h = await fixture(t);
  assert.equal((await request(h.port, '/inventory', 'not JSON', h.session)).body.error, 'INVALID_REQUEST');
  assert.equal((await request(h.port, '/inventory', [], h.session)).body.error, 'INVALID_BODY');
  assert.equal((await request(h.port, '/inventory', {}, { ...h.session, headers: { 'Content-Type': 'text/plain' } })).body.error, 'JSON_REQUIRED');
  const huge = await request(h.port, '/inventory', { padding: 'x'.repeat(65536) }, h.session);
  assert.equal(huge.status, 400); assert.equal(huge.body.error, 'BODY_TOO_LARGE');
  assert.ok(!huge.text.includes(h.session.token));
  assert.throws(() => cleanInventory({ devices: Array(17).fill({}), actions: [] }), /INVALID_INVENTORY/);
});

test('inventory only reports visible owned actions, never synthesizes ownership of FREE/foreign keys', async t => {
  const h = await fixture(t), result = cleanInventory({ ...h.inventory, token: 'secret', profiles: ['invented'],
    actions: [...h.inventory.actions, { context: 'other-device', deviceId: 'absent', row: 0, column: 1 },
      { context: 'out-of-range', deviceId: 'xl-1', row: -1, column: 1 }] });
  assert.equal(result.actions.length, 1); assert.equal(result.actions[0].context, 'action-a'); assert.equal(result.actions[0].visible, true);
  assert.equal(result.token, undefined); assert.equal(result.profiles, undefined);
  assert.equal(h.bridge.status().inventory.actions.length, 1);
  assert.throws(() => cleanInventory({ devices: [...h.inventory.devices, ...h.inventory.devices], actions: [] }), /INVALID_INVENTORY/);
  assert.throws(() => cleanInventory({ devices: h.inventory.devices, actions: [...h.inventory.actions, ...h.inventory.actions] }), /INVALID_INVENTORY/);
  assert.throws(() => cleanInventory({ devices: h.inventory.devices,
    actions: [...h.inventory.actions, { ...h.inventory.actions[0], context: 'different-context', column: 1 }] }), /INVALID_INVENTORY/);
});

test('layout ACK requires exactly the requested revision, not a previous or later frame', async t => {
  const h = await fixture(t), pending = h.bridge.instruction('applyLayout', { layoutRevision: 5 });
  const frame = await request(h.port, '/state', undefined, h.session), instruction = frame.body.instructions[0];
  await request(h.port, '/result', { id: instruction.id, ok: true, deviceConfirmed: true, layoutRevision: 4 }, h.session);
  const result = await pending;
  assert.equal(result.deviceConfirmed, false);
});

test('profile instructions only originate in an explicit request and complete on SDK result', async t => {
  const h = await fixture(t);
  assert.deepEqual((await request(h.port, '/state', undefined, h.session)).body.instructions, []);
  const instruction = h.bridge.instruction('back', { deviceId: 'xl-1' });
  const frame = await request(h.port, '/state', undefined, h.session);
  assert.equal(frame.body.instructions.length, 1); const entry = frame.body.instructions[0];
  assert.equal(entry.type, 'back'); assert.equal(entry.deviceId, 'xl-1');
  await request(h.port, '/result', { id: entry.id, ok: true, status: 'request-sent-not-activation-confirmed' }, h.session);
  const ack = await instruction; assert.equal(ack.ok, true); assert.equal(ack.deviceConfirmed, false);
  assert.deepEqual((await request(h.port, '/state', undefined, h.session)).body.instructions, []);
  assert.equal(h.calls.length, 0);
});

test('rate-limited native clients do not expose or execute a flood of commands', async t => {
  const h = await fixture(t); let rejected = false;
  for (let i = 0; i < 82; i++) if ((await request(h.port, '/state', undefined, h.session)).status === 429) rejected = true;
  assert.equal(rejected, true); assert.equal(h.calls.length, 0);
  h.advance(1001); assert.equal((await request(h.port, '/state', undefined, h.session)).status, 200);
});

test('slow body authorized by an old session cannot execute after replacement pairing', async t => {
  const h = await fixture(t);
  const text = JSON.stringify({ commandId: 'old-slow-command', type: 'start', timerId: 't1', deviceId: 'xl-1' });
  let end;
  const response = new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: h.port, path: '/command', method: 'POST', headers: {
      Authorization: `Bearer ${h.session.token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) } }, res => {
      let data = ''; res.on('data', chunk => { data += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject); req.write(text.slice(0, -1)); end = () => req.end(text.slice(-1));
  });
  // This GET is processed only after the first request's bytes reached the loopback server.
  await request(h.port, '/state', undefined, h.session);
  const next = await h.pair(); h.refresh(); await request(h.port, '/inventory', h.inventory, next);
  end(); const result = await response;
  assert.equal(result.status, 401); assert.equal(h.calls.length, 0);
});
