'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const checksumFile = path.join(root, 'docs', 'checksums', `ProTimer-${version}-SHA256SUMS.txt`);
const checksums = new Map(
  fs.readFileSync(checksumFile, 'utf8').trim().split(/\r?\n/).map((line) => {
    const match = line.match(/^([a-f0-9]{64})\s+(.+)$/);
    if (!match) throw new Error(`Packaging check failed: malformed checksum line: ${line}`);
    return [match[2], match[1]];
  })
);

function fail(message) {
  throw new Error(`Packaging check failed: ${message}`);
}

const scoop = JSON.parse(fs.readFileSync(path.join(root, 'packaging', 'scoop', 'protimer.json'), 'utf8'));
if (scoop.version !== version) fail(`Scoop version ${scoop.version} does not match ${version}`);
const portableName = `ProTimer-${version}-portable.exe`;
const scoop64 = scoop.architecture?.['64bit'];
if (!scoop64?.url.includes(`/v${version}/${portableName}`)) fail('Scoop URL does not target the current release');
if (scoop64.hash !== checksums.get(portableName)) fail('Scoop hash does not match the release checksum');
if (!scoop.autoupdate?.architecture?.['64bit']?.url.includes('ProTimer-$version-portable.exe')) {
  fail('Scoop autoupdate URL is missing');
}

const nuspec = fs.readFileSync(path.join(root, 'packaging', 'chocolatey', 'protimer.nuspec'), 'utf8');
const install = fs.readFileSync(path.join(root, 'packaging', 'chocolatey', 'tools', 'chocolateyInstall.ps1'), 'utf8');
if (!nuspec.includes('<id>protimer</id>')) fail('Chocolatey package id is missing');
if (!nuspec.includes(`<version>${version}</version>`)) fail('Chocolatey version does not match package.json');
if (!nuspec.includes('<packageSourceUrl>https://github.com/srdjankotarlic/protimer/tree/main/packaging/chocolatey</packageSourceUrl>')) {
  fail('Chocolatey packageSourceUrl is missing');
}
const setupName = `ProTimer-Setup-${version}.exe`;
if (!install.includes(`/v${version}/${setupName}`)) fail('Chocolatey URL does not target the current installer');
if (!install.includes(`checksum64     = '${checksums.get(setupName)}'`)) {
  fail('Chocolatey checksum does not match the release checksum');
}
if (!install.includes("silentArgs     = '/S'")) fail('Chocolatey silent install argument is missing');

console.log(`PACKAGING_OK v${version}`);
