// A registered Quick Tunnel may precede its public DNS record. Querying it too
// early can cache NXDOMAIN in the computer/router for the whole startup window.
async function waitForTunnelReady({ url, totalMs = 30000, isCurrent = () => true,
  probeTime, probeTransport, now = Date.now,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const deadline = now() + Math.max(1000, totalMs);
  const warmup = new URL(url).hostname.endsWith('.trycloudflare.com') ? 15000 : 1500;
  const warmupEnd = Math.min(deadline, now() + warmup);
  while (now() < warmupEnd && isCurrent()) await sleep(Math.min(250, warmupEnd - now()));
  for (let attempt = 0; now() < deadline && isCurrent(); attempt++) {
    let remaining = deadline - now();
    if (remaining < 300) break;
    const timeOK = await probeTime(url, Math.min(4000, remaining));
    remaining = deadline - now();
    if (timeOK && isCurrent() && remaining >= 300 && await probeTransport(url, Math.min(4000, remaining))) return isCurrent();
    remaining = deadline - now();
    if (remaining > 0 && isCurrent()) await sleep(Math.min(750 + attempt * 250, 2000, remaining));
  }
  return false;
}

module.exports = { waitForTunnelReady };
