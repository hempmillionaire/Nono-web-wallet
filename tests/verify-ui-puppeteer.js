/**
 * verify-ui-puppeteer.js — smoke test tab + wallet-age on verify.html
 * Run on VPS: node tests/verify-ui-puppeteer.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const FILE = 'file://' + path.join(ROOT, 'verify.html');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(FILE, { waitUntil: 'networkidle0', timeout: 120000 });

  if (errors.length) {
    console.error('PAGE ERRORS:', errors);
    process.exit(1);
  }

  await page.click('.tab[data-tab="create"]');
  const createVisible = await page.evaluate(() => {
    const p = document.getElementById('tab-create');
    return p && getComputedStyle(p).display !== 'none';
  });
  if (!createVisible) throw new Error('Create tab panel not visible');

  await page.click('.tab[data-tab="seed"]');
  await page.click('.wallet-age-btn[data-age="month"]');
  const ageOk = await page.evaluate(() => {
    const lbl = document.getElementById('restore-height-selected');
    return lbl && lbl.style.display === 'block' && lbl.textContent.length > 10;
  });
  if (!ageOk) throw new Error('Wallet age button did not update UI');

  await page.click('.tab[data-tab="keys"]');
  const keysVisible = await page.evaluate(() => {
    const p = document.getElementById('tab-keys');
    return p && getComputedStyle(p).display !== 'none';
  });
  if (!keysVisible) throw new Error('Keys tab not visible');

  const wallet = await page.evaluate(() => {
    const w = MoneroKeys.generateWallet('english', 'nono-mainnet');
    return { a: w.address[0], len: w.address.length };
  });
  if (wallet.a !== 'N' || wallet.len !== 95) throw new Error('Create path: ' + JSON.stringify(wallet));

  console.log('OK puppeteer: tabs, wallet-age, generate N-address');
  await browser.close();
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});