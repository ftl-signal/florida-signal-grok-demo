#!/usr/bin/env node
const assert = require('assert');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1512, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err));
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#latest-intake-batch');

  const navButtons = page.locator('#nav-tabs > button');
  const navCount = await navButtons.count();
  assert.strictEqual(navCount, 9, `Expected 9 nav tabs, found ${navCount}`);

  const tabTargets = [
    '#section-overview',
    '#section-pipeline',
    '#section-permits',
    '#section-enrichment',
    '#section-reports',
    '#section-sources',
    '#section-ingestion',
    '#section-signals',
    '#section-system'
  ];

  for (let i = 0; i < tabTargets.length; i++) {
    await navButtons.nth(i).click();
    const sectionId = tabTargets[i];
    await page.waitForSelector(`${sectionId}.active`, { timeout: 4000 });
  }

  await navButtons.nth(0).click();
  const heroNumber = await page.locator('#latest-intake-batch span[style*="80px"]').first().textContent();
  assert.strictEqual((heroNumber || '').trim(), '41', `Expected Latest Intake hero number 41, got ${heroNumber}`);

  await navButtons.nth(2).click();
  await page.waitForSelector('#permits-tbody tr', { timeout: 8000 });
  await page.locator('#permits-tbody tr').first().click();
  await page.waitForSelector('#permit-modal.flex', { timeout: 4000 });
  const drawerVisible = await page.locator('#permit-modal').evaluate((el) => !el.classList.contains('hidden'));
  assert.strictEqual(drawerVisible, true, 'Permit drawer did not open');

  assert.strictEqual(consoleErrors.length, 0, `Console errors found:\n${consoleErrors.join('\n')}`);
  assert.strictEqual(pageErrors.length, 0, `Page errors found:\n${pageErrors.join('\n')}`);

  await browser.close();
  console.log('PASS smoke.spec.js');
})().catch((err) => {
  console.error('FAIL smoke.spec.js');
  console.error(err.stack || err);
  process.exit(1);
});
