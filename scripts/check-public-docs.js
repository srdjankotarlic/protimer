'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const releaseNotes = `docs/RELEASE-NOTES-${version}.md`;
const publicFiles = ['README.md', 'README.sr.md', 'SUPPORT.md', 'docs/index.html', releaseNotes];

function fail(message) {
  throw new Error(`Public docs check failed: ${message}`);
}

for (const file of publicFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(`missing ${file}`);
}

const publicText = publicFiles
  .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');

for (const match of publicText.matchAll(/releases\/download\/v([^/]+)/g)) {
  if (match[1] !== version) fail(`found v${match[1]} download in current public docs; package version is ${version}`);
}

const expectedAssets = [
  `ProTimer-${version}-arm64.dmg`,
  `ProTimer-Setup-${version}.exe`,
  `ProTimer-${version}-portable.exe`,
  `ProTimer-${version}-SHA256SUMS.txt`
];
for (const asset of expectedAssets) {
  if (!publicText.includes(asset)) fail(`current public docs do not reference ${asset}`);
}

const notes = fs.readFileSync(path.join(root, releaseNotes), 'utf8');
if (!notes.startsWith(`# ProTimer v${version}\n`)) fail(`${releaseNotes} needs an exact release heading`);

const htmlPath = path.join(root, 'docs/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
if ((html.match(/<h1(?:\s|>)/g) || []).length !== 1) fail('docs/index.html must contain exactly one h1');
if (!html.includes('<link rel="canonical" href="https://srdjankotarlic.github.io/protimer/">')) fail('canonical URL is missing or changed');
if (!html.includes(`PROTIMER ${version} · LATEST RELEASE`)) fail('landing-page release badge does not match package.json');

const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
if (jsonLdBlocks.length !== 1) fail(`expected one JSON-LD block, found ${jsonLdBlocks.length}`);
try {
  JSON.parse(jsonLdBlocks[0][1]);
} catch (error) {
  fail(`invalid JSON-LD: ${error.message}`);
}

for (const match of html.matchAll(/(?:href|src|poster)="([^"]+)"/g)) {
  const target = match[1];
  if (/^(?:https?:|#|mailto:|tel:)/.test(target)) continue;
  const localPath = path.resolve(path.dirname(htmlPath), target.split(/[?#]/)[0]);
  if (!localPath.startsWith(path.dirname(htmlPath) + path.sep)) fail(`unsafe local target ${target}`);
  if (!fs.existsSync(localPath)) fail(`missing local target ${target}`);
}

const sitemap = fs.readFileSync(path.join(root, 'docs/sitemap.xml'), 'utf8');
for (const image of ['screenshot-control.png', 'screenshot-output.png', 'screenshot-backstage.png', 'og-banner.jpg']) {
  if (!sitemap.includes(`/protimer/${image}`)) fail(`sitemap is missing ${image}`);
}

console.log(`PUBLIC_DOCS_OK v${version}`);
