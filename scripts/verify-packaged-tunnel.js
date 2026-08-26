'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const VERSION = '2026.8.2';
const SHA = {
  darwin: 'b61054d3d6326ea558cb49826eebf5676e0d0a36d51b546975096ca3e0e3c89d',
  win32: 'c29eee2b121f5436a642eed69fd9767da7e7b8c510fa50aaa130337f931357b5'
};

module.exports = async function verifyPackagedTunnel(context) {
  const platform = context.electronPlatformName;
  if (platform !== 'darwin' && platform !== 'win32') return;
  const binary = platform === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources', 'cloudflared')
    : path.join(context.appOutDir, 'resources', 'cloudflared.exe');
  const license = platform === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources', 'licenses', 'cloudflared-LICENSE.txt')
    : path.join(context.appOutDir, 'resources', 'licenses', 'cloudflared-LICENSE.txt');
  if (!fs.existsSync(binary)) throw new Error(`Missing packaged cloudflared: ${binary}`);
  if (!fs.existsSync(license)) throw new Error(`Missing packaged cloudflared license: ${license}`);
  const actual = crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex');
  if (actual !== SHA[platform]) throw new Error(`Packaged cloudflared checksum mismatch: ${actual}`);

  if ((platform === 'darwin' && process.platform === 'darwin') || (platform === 'win32' && process.platform === 'win32')) {
    const version = spawnSync(binary, ['--version'], { encoding: 'utf8', windowsHide: true });
    if (version.status !== 0 || !String(version.stdout || version.stderr).includes(VERSION))
      throw new Error('Packaged cloudflared version verification failed');
  }
  if (platform === 'darwin' && process.platform === 'darwin') {
    const signature = spawnSync('codesign', ['--verify', '--strict', binary], { encoding: 'utf8' });
    if (signature.status !== 0) throw new Error(`Packaged cloudflared signature verification failed: ${signature.stderr}`);
  }
  if (platform === 'win32' && process.platform === 'win32') {
    const command = `(Get-AuthenticodeSignature -LiteralPath '${binary.replace(/'/g, "''")}').Status`;
    const signature = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', windowsHide: true });
    if (signature.status !== 0 || String(signature.stdout).trim() !== 'Valid')
      throw new Error(`Packaged cloudflared signature verification failed: ${signature.stdout || signature.stderr}`);
  }
  console.log(`Verified packaged cloudflared ${VERSION}: ${binary}`);
};
