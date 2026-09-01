'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const releaseNotes = `docs/RELEASE-NOTES-${version}.md`;
const guideDir = path.join(root, 'docs', 'guides');
const guideFiles = fs.existsSync(guideDir)
  ? fs.readdirSync(guideDir).filter((file) => file.endsWith('.html')).map((file) => `docs/guides/${file}`)
  : [];
const focusedPages = [
  {
    file: 'docs/index.html',
    canonical: 'https://srdjankotarlic.github.io/protimer/',
    releaseBadge: true,
    structuredData: true
  },
  {
    file: 'docs/free-stage-timer/index.html',
    canonical: 'https://srdjankotarlic.github.io/protimer/free-stage-timer/',
    structuredData: true
  },
  {
    file: 'docs/obs-stage-timer/index.html',
    canonical: 'https://srdjankotarlic.github.io/protimer/obs-stage-timer/',
    structuredData: true
  },
  {
    file: 'docs/companion-stage-timer/index.html',
    canonical: 'https://srdjankotarlic.github.io/protimer/companion-stage-timer/',
    structuredData: true
  },
  {
    file: 'docs/press/index.html',
    canonical: 'https://srdjankotarlic.github.io/protimer/press/',
    structuredData: true
  }
];
const guidePages = guideFiles.map((file) => ({
  file,
  canonical: `https://srdjankotarlic.github.io/protimer/${file.replace(/^docs\//, '').replace(/index\.html$/, '')}`
}));
const htmlPages = [...focusedPages, ...guidePages];
const publicFiles = [
  'README.md',
  'README.sr.md',
  'SUPPORT.md',
  'docs/guide.css',
  'docs/guides/guide.css',
  'docs/robots.txt',
  ...htmlPages.map((page) => page.file),
  releaseNotes
];

function fail(message) {
  throw new Error(`Public docs check failed: ${message}`);
}

for (const file of publicFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(`missing ${file}`);
}

const publicText = publicFiles
  .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');

const proTimerReleaseDownloads =
  /github\.com\/srdjankotarlic\/protimer\/releases\/download\/v([^/]+)/g;
for (const match of publicText.matchAll(proTimerReleaseDownloads)) {
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

const docsRoot = path.join(root, 'docs');
const titles = new Set();
const descriptions = new Set();

for (const page of htmlPages) {
  const htmlPath = path.join(root, page.file);
  const html = fs.readFileSync(htmlPath, 'utf8');
  if ((html.match(/<h1(?:\s|>)/g) || []).length !== 1) fail(`${page.file} must contain exactly one h1`);

  const canonical = html.match(/<link rel="canonical" href="([^"]+)"\s*\/?>/)?.[1];
  if (canonical !== page.canonical) fail(`${page.file} canonical URL is missing or changed`);
  if (page.releaseBadge && !html.includes(`PROTIMER ${version} · LATEST RELEASE`)) {
    fail('landing-page release badge does not match package.json');
  }

  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  if (!title) fail(`${page.file} is missing a title`);
  if (titles.has(title)) fail(`duplicate title: ${title}`);
  titles.add(title);

  const description = html.match(/<meta name="description" content="([^"]+)"\s*\/?>/)?.[1];
  if (!description) fail(`${page.file} is missing a meta description`);
  if (descriptions.has(description)) fail(`duplicate meta description in ${page.file}`);
  descriptions.add(description);

  if (page.structuredData) {
    const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    if (jsonLdBlocks.length !== 1) fail(`${page.file} expected one JSON-LD block, found ${jsonLdBlocks.length}`);
    try {
      JSON.parse(jsonLdBlocks[0][1]);
    } catch (error) {
      fail(`${page.file} has invalid JSON-LD: ${error.message}`);
    }
  }

  for (const match of html.matchAll(/(?:href|src|poster)="([^"]+)"/g)) {
    const target = match[1];
    if (/^(?:https?:|#|mailto:|tel:)/.test(target)) continue;
    const localPath = path.resolve(path.dirname(htmlPath), target.split(/[?#]/)[0]);
    if (localPath !== docsRoot && !localPath.startsWith(docsRoot + path.sep)) {
      fail(`${page.file} has unsafe local target ${target}`);
    }
    if (!fs.existsSync(localPath)) fail(`${page.file} has missing local target ${target}`);
    if (fs.statSync(localPath).isDirectory() && !fs.existsSync(path.join(localPath, 'index.html'))) {
      fail(`${page.file} links to directory without index.html: ${target}`);
    }
  }
}

const sitemap = fs.readFileSync(path.join(root, 'docs/sitemap.xml'), 'utf8');
for (const page of htmlPages) {
  if (!sitemap.includes(`<loc>${page.canonical}</loc>`)) fail(`sitemap is missing ${page.canonical}`);
}
for (const image of ['screenshot-control.png', 'screenshot-output.png', 'screenshot-backstage.png', 'og-banner.jpg']) {
  if (!sitemap.includes(`/protimer/${image}`)) fail(`sitemap is missing ${image}`);
}

const robots = fs.readFileSync(path.join(root, 'docs/robots.txt'), 'utf8');
if (!robots.includes('User-agent: *') || !robots.includes('Allow: /')) {
  fail('robots.txt must allow public crawling');
}
if (!robots.includes('Sitemap: https://srdjankotarlic.github.io/protimer/sitemap.xml')) {
  fail('robots.txt must point to the canonical sitemap');
}

const landing = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
if (!landing.includes('"@type": "VideoObject"') || !landing.includes('/protimer/demo.mp4')) {
  fail('landing page is missing demo VideoObject structured data');
}

console.log(`PUBLIC_DOCS_OK v${version}`);
