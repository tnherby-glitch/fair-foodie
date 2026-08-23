// Captures App Store screenshots at Apple's 6.5" iPhone size (1284x2778):
// 428x926 CSS viewport at 3x device scale. Drives the local dev server with
// the seeded demo persona so screens show rich, real content.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:8899';
const OUT = 'store/screenshots';
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { name: '01-home',    hash: '#/home',        wait: 2500 },
  { name: '02-food',    hash: '#/food/f2253',  wait: 2500 },
  { name: '03-map',     hash: '#/map?list=l0', wait: 3000 },
  { name: '04-list',    hash: '#/list/l0',     wait: 2500 },
  { name: '05-passport', hash: '#/profile',    wait: 2000 },
  { name: '06-vendors', hash: '#/vendors',     wait: 2500 },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--force-device-scale-factor=3'],
});
const page = await browser.newPage();
await page.setViewport({ width: 428, height: 926, deviceScaleFactor: 3 });

// boot in demo mode, then sign in as the seeded influencer (richest content)
await page.goto(BASE + '/?demo=1', { waitUntil: 'networkidle2', timeout: 60000 });
await page.evaluate(() => {
  S.currentUserId = 'u_inf2';
  save();
});
await page.addStyleTag({ content: '::-webkit-scrollbar{display:none!important}' });

for (const s of SHOTS) {
  await page.evaluate(h => { location.hash = h; render(); window.scrollTo(0, 0); }, s.hash);
  await new Promise(r => setTimeout(r, s.wait));
  await page.screenshot({ path: `${OUT}/${s.name}.png` });
  console.log('captured', s.name);
}
await browser.close();
console.log('done');
