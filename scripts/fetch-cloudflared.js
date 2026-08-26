#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const VERSION = '2026.8.2';
const TARGETS = {
  mac: {
    asset: 'cloudflared-darwin-arm64.tgz',
    assetSha256: '9042c2c5d8b2de78e60f313d5fb31b6c5c1cebde787a3caf1f2c9588084ac442',
    binarySha256: 'b61054d3d6326ea558cb49826eebf5676e0d0a36d51b546975096ca3e0e3c89d',
    output: 'cloudflared-darwin-arm64'
  },
  win: {
    asset: 'cloudflared-windows-amd64.exe',
    assetSha256: 'c29eee2b121f5436a642eed69fd9767da7e7b8c510fa50aaa130337f931357b5',
    binarySha256: 'c29eee2b121f5436a642eed69fd9767da7e7b8c510fa50aaa130337f931357b5',
    output: 'cloudflared-windows-amd64.exe'
  }
};

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function verify(file, expected, label) {
  const actual = sha256(file);
  if (actual !== expected) throw new Error(`${label} checksum mismatch: ${actual}`);
}

async function main() {
  const targetName = process.argv[2] || (process.platform === 'win32' ? 'win' : 'mac');
  const target = TARGETS[targetName];
  if (!target) throw new Error('Usage: node scripts/fetch-cloudflared.js mac|win');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'protimer-cloudflared-'));
  const archive = path.join(tempDir, target.asset);
  try {
    const url = `https://github.com/cloudflare/cloudflared/releases/download/${VERSION}/${target.asset}`;
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`cloudflared download failed: HTTP ${response.status}`);
    fs.writeFileSync(archive, Buffer.from(await response.arrayBuffer()), { flag: 'wx' });
    verify(archive, target.assetSha256, target.asset);

    let binary = archive;
    if (targetName === 'mac') {
      const unpack = spawnSync('tar', ['-xzf', archive, '-C', tempDir], { stdio: 'inherit' });
      if (unpack.status !== 0) throw new Error('Could not extract cloudflared archive');
      binary = path.join(tempDir, 'cloudflared');
    }
    verify(binary, target.binarySha256, 'cloudflared binary');

    const vendorDir = path.join(__dirname, '..', 'vendor');
    const output = path.join(vendorDir, target.output);
    fs.mkdirSync(vendorDir, { recursive: true });
    fs.copyFileSync(binary, output);
    if (targetName === 'mac') fs.chmodSync(output, 0o755);

    if ((targetName === 'mac' && process.platform === 'darwin') || (targetName === 'win' && process.platform === 'win32')) {
      const version = spawnSync(output, ['--version'], { encoding: 'utf8', windowsHide: true });
      if (version.status !== 0 || !String(version.stdout || version.stderr).includes(VERSION))
        throw new Error('cloudflared version verification failed');
    }
    console.log(`cloudflared ${VERSION} ready: ${output}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.message); process.exit(1); });
