'use strict';

const fs = require('fs');
const path = require('path');

const key = '1791077afc203704cce5645579f7f15c';
const host = 'srdjankotarlic.github.io';
const projectPath = '/protimer/';
const keyLocation = `https://${host}${projectPath}${key}.txt`;
const sitemapPath = path.resolve(__dirname, '..', 'docs', 'sitemap.xml');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
const urlList = [...sitemap.matchAll(/<loc>(https:\/\/[^<]+)<\/loc>/g)]
  .map((match) => match[1])
  .filter((candidate) => {
    const url = new URL(candidate);
    return url.hostname === host && url.pathname.startsWith(projectPath);
  });

if (!urlList.length) throw new Error('IndexNow: no canonical ProTimer URLs found in sitemap.xml');
if (new Set(urlList).size !== urlList.length) throw new Error('IndexNow: sitemap contains duplicate URLs');

const payload = { host, key, keyLocation, urlList };

if (process.argv.includes('--dry-run')) {
  console.log(`INDEXNOW_DRY_RUN_OK urls=${urlList.length} keyLocation=${keyLocation}`);
  process.exit(0);
}

(async () => {
  const keyResponse = await fetch(keyLocation, { redirect: 'follow' });
  const hostedKey = (await keyResponse.text()).trim();
  if (!keyResponse.ok || hostedKey !== key) {
    throw new Error(`IndexNow: hosted key verification failed (${keyResponse.status})`);
  }

  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  });
  const body = await response.text();
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`IndexNow submission failed (${response.status}): ${body.slice(0, 300)}`);
  }
  console.log(`INDEXNOW_OK status=${response.status} urls=${urlList.length}`);
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
