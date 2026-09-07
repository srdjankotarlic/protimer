const { test } = require('node:test');
const assert = require('node:assert/strict');
const { waitForTunnelReady } = require('../tunnel-tools');

function simulation(overrides = {}) {
  let time = 0;
  const calls = [];
  return { calls, run: () => waitForTunnelReady({
    url: 'https://example-test.trycloudflare.com', now: () => time,
    sleep: async ms => { time += ms; },
    probeTime: async () => { calls.push(time); return true; },
    probeTransport: async () => true,
    ...overrides
  }) };
}
test('Quick Tunnel DNS is not queried before the propagation warmup', async () => {
  const s = simulation(); assert.equal(await s.run(), true); assert.deepEqual(s.calls, [15000]);
});
test('fallback provider does not wait for Quick Tunnel DNS', async () => {
  const s = simulation({ url: 'https://example.loca.lt' });
  assert.equal(await s.run(), true); assert.deepEqual(s.calls, [1500]);
});
test('cancelled or exhausted startup never probes an unready URL', async () => {
  for (const overrides of [{ totalMs: 1000 }, { isCurrent: () => false }]) {
    const s = simulation(overrides); assert.equal(await s.run(), false); assert.deepEqual(s.calls, []);
  }
});
test('failed readiness retries within the deadline and requires both probes', async () => {
  let time = 0, attempts = 0;
  const ok = await waitForTunnelReady({ url: 'https://example.loca.lt', totalMs: 5000,
    now: () => time, sleep: async ms => { time += ms; },
    probeTime: async () => { attempts++; return true; }, probeTransport: async () => false });
  assert.equal(ok, false); assert.ok(attempts > 1); assert.equal(time, 5000);
});
