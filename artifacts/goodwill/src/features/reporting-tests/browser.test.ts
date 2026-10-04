import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import express from '../../../../api-server/node_modules/express/index.js';
import { createDataRouter, seedFixturePack } from '../../../../api-server/src/goodwill/data';
import { setup, upload, file, root, august } from '../../../../api-server/tests/data/helpers';

/**
 * TEST ONLY: actual parser/reporting/export Router, explicit unchanged fixture
 * seed and injected repository/archive. No production routes/auth are changed.
 * The acquisition history endpoint is a UI contract stub, NOT replay evidence.
 */
test('real reporting UI against the data Router: 15 datasets, filters, source controls, evidence, CSV, snapshots, intake and review', { timeout: 180_000 }, async () => {
  const { chromium } = await import(process.env.GOODWILL_PLAYWRIGHT_MODULE ?? 'playwright');
  const env = await setup();
  await seedFixturePack(env.intake, root, { confirmSyntheticOnly: true, owner: 'test_operator' }, async (url, bytes) => {
    env.archive.inbox.set(url.split('/').at(-1)!, bytes);
  });
  const oracle = JSON.parse(execFileSync('python', ['docs/goodwill/data/independent-controls.py'], { encoding: 'utf8' }));
  const app = express();
  app.use(express.json());
  // Run history is stubbed only here; browser acquisition is a different lane.
  app.get('/api/goodwill/v2/runs', (_req, res) => res.json({ items: [], total: 0, offset: 0, limit: 20 }));
  app.use('/api/goodwill/v2', createDataRouter(env.intake, env.reporting, async () => 'test_operator'));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch({ headless: true, ...(process.env.GOODWILL_CHROMIUM ? { executablePath: process.env.GOODWILL_CHROMIUM } : {}) });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const errors: string[] = [];
  const requests: { path: string; body: any }[] = [];
  let outage = false;
  let denied = false;
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('**/api/goodwill/v2/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({ path: url.pathname, body: request.postDataJSON() });
    if (denied) return route.fulfill({ status: 401, json: { code: 'OPERATOR_AUTH_REQUIRED', message: 'Authorized operator required.' } });
    if (outage) return route.fulfill({ status: 503, json: { code: 'STORAGE_UNAVAILABLE', message: 'Test service outage; last-good retained.' } });
    const response = await route.fetch({ url: `http://127.0.0.1:${port}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  await page.route('https://test.invalid/**', async route => {
    assert.equal(route.request().method(), 'PUT');
    env.archive.inbox.set(new URL(route.request().url()).pathname.slice(1), new Uint8Array(route.request().postDataBuffer()!));
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' } });
  });
  if (!process.env.REPLIT_DEV_DOMAIN) throw new Error('REPLIT_DEV_DOMAIN is required for the managed preview test.');
  const preview = `https://${process.env.REPLIT_DEV_DOMAIN}/src/features/reporting/inspection.html`;
  const money = (cents: number) => `${cents < 0 ? '-' : ''}$${Math.floor(Math.abs(cents) / 100).toLocaleString('en-US')}.${String(Math.abs(cents) % 100).padStart(2, '0')}`;
  const waitText = async (selector: string, text: string) => {
    try {
      await page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent === text, { selector, text }, { timeout: 15000 });
    } catch (error) {
      console.error('Figure mismatch', { selector, expected: text, actual: await page.locator(selector).allTextContents(), alerts: await page.getByRole('alert').allTextContents(), recentQueries: requests.slice(-5).map(r => ({ metric: r.body?.metricId, source: r.body?.sourceId, period: r.body?.period })) });
      throw error;
    }
  };
  const nav = (name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
  const selectSource = async (source: string) => {
    await page.getByLabel('Source / platform').selectOption(source);
    await page.getByLabel('Store attribution').selectOption('');
  };
  const figureSection = () => page.locator('section').filter({ has: page.getByRole('heading', { name: 'Source-local financial result', exact: true }) });
  const exportCsv = async (button: string, scope = figureSection()) => {
    const downloaded = page.waitForEvent('download');
    await scope.getByRole('button', { name: button, exact: true }).click();
    const result = await downloaded;
    assert.match(result.suggestedFilename(), /\.csv$/);
    return readFile((await result.path())!, 'utf8');
  };
  try {
    await page.goto(preview);
    await waitText('[data-testid="metric-net_item_sales"]', money(oracle.net_items.upright));
    assert.equal(await page.getByLabel('Source / platform').locator('option').count(), 9);
    assert.equal(await page.getByLabel('Store attribution').locator('option').count(), 26);
    const customerSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Daily platform-local customers', exact: true }) });
    await customerSection.getByText('Daily distinct buyers are shown below.', { exact: false }).waitFor();
    assert.equal(await customerSection.locator('[data-testid="metric-daily_customers"]').innerText(), 'Unavailable');
    const daily = await customerSection.locator('table').first().locator('tbody tr').evaluateAll(rows =>
      Object.fromEntries(rows.map(row => [row.children[0].textContent, Number(row.children[1].textContent)])));
    assert.deepEqual(daily, oracle.customers.upright);
    // Statements are month-based; a day breakdown would correctly be unavailable.
    await page.getByLabel('Breakdown', { exact: true }).selectOption('none');
    const controls: Record<string, { expected: number; actual: string }> = {};
    for (const [metricId, expected] of [['net_item_sales', oracle.net_items], ['source_net', oracle.source_net], ['shipping_expense', oracle.expenses]] as const) {
      for (const [source, cents] of Object.entries(expected)) {
        await selectSource(source);
        await page.getByLabel('Financial definition').selectOption(metricId);
        await waitText(`[data-testid="metric-${metricId}"]`, money(cents as number));
        controls[`${source}/${metricId}`] = { expected: cents as number, actual: await page.locator(`[data-testid="metric-${metricId}"]`).innerText() };
      }
    }
    await selectSource('upright');
    await page.getByLabel('Financial definition').selectOption('net_item_sales');
    await page.getByLabel('Store attribution').selectOption('__unknown__');
    await page.getByLabel('Breakdown', { exact: true }).selectOption('store');
    const unknown = (await env.reporting.query({ sourceId: 'upright', metricId: 'net_item_sales', period: august, groupBy: 'store', storeId: '__unknown__' })).result;
    await waitText('[data-testid="metric-net_item_sales"]', money(unknown.value!));
    assert.ok(requests.some(r => r.body?.sourceId === 'upright' && r.body?.storeId === '__unknown__' && r.body?.groupBy === 'store'));
    await selectSource('ebay');
    await page.getByLabel('Breakdown', { exact: true }).selectOption('none');
    await waitText('[data-testid="metric-net_item_sales"]', money(oracle.net_items.ebay));
    const pinnedText = await figureSection().innerText();
    const pinnedPublication = /Publication: (\S+)/.exec(pinnedText)![1];
    const summary = await exportCsv('Summary CSV');
    assert.ok(summary.includes(pinnedPublication));
    assert.ok(summary.includes(String(oracle.net_items.ebay)));
    assert.ok(summary.includes('synthetic'));
    await figureSection().getByRole('button', { name: 'Inspect contributing evidence' }).click();
    await page.getByText('Pinned publication:', { exact: false }).waitFor();
    assert.ok((await page.getByRole('main').innerText()).includes(pinnedPublication));
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await page.getByText('26–50 of', { exact: false }).waitFor();
    const evidenceCsv = await exportCsv('Evidence CSV', page.getByRole('main'));
    assert.ok(evidenceCsv.includes(pinnedPublication));
    assert.ok(requests.filter(r => r.path.endsWith('/evidence/query')).every(r => r.body.publicationId === pinnedPublication));
    await nav('Listings');
    await waitText('[data-testid="metric-listings"]', Number(oracle.listings.ebay).toLocaleString('en-US'));
    await nav('Backlog');
    assert.equal(await page.locator('[data-testid="metric-backlog"]').count(), 0);
    const snapshot = Object.keys(oracle.snapshots).at(-1)!;
    await page.getByLabel('Snapshot timestamp').fill(snapshot);
    await page.getByRole('button', { name: 'Select snapshot', exact: true }).click();
    await waitText('[data-testid="metric-backlog"]', Number(oracle.snapshots[snapshot].ebay).toLocaleString('en-US'));
    await page.getByLabel('Snapshot timestamp').fill('2026-08-02T23:59:59-04:00');
    await page.getByRole('button', { name: 'Select snapshot', exact: true }).click();
    await waitText('[data-testid="metric-backlog"]', 'Unavailable');
    await nav('Definitions');
    await page.getByText('Dataset roles, grain and reporting basis', { exact: true }).waitFor();
    assert.equal(await page.locator('table').first().locator('tbody tr').count(), 15);
    await nav('Operations');
    assert.equal(await page.getByLabel('Dataset', { exact: true }).locator('option').count(), 15);
    const original = await file('08_ebay_listing_sales_aug2026.csv');
    await page.getByLabel('Dataset', { exact: true }).selectOption('ebay');
    await page.getByLabel('Original synthetic CSV', { exact: false }).setInputFiles({ name: 'synthetic-original.csv', mimeType: 'text/csv', buffer: original });
    const importButton = page.getByRole('button', { name: 'Upload and import original', exact: true });
    assert.equal(await importButton.isDisabled(), true);
    await page.getByLabel('I confirm this file contains synthetic data only.', { exact: true }).check();
    await importButton.click();
    await page.getByText('Server recorded', { exact: false }).waitFor();
    await page.getByRole('heading', { name: 'Batch detail and reconciliation', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Original synthetic CSV', { exact: false }).inputValue(), '');
    assert.ok((await page.getByRole('main').innerText()).includes('duplicate'));
    assert.ok(Array.from(env.archive.inbox.values()).some(bytes => Buffer.from(bytes).equals(original)));
    const lines = original.toString().trimEnd().split('\n');
    const changed = lines[1].split(',');
    changed[8] = (Number(changed[8]) + 1).toFixed(2);
    changed[13] = (Number(changed[13]) + 1).toFixed(2);
    // A correction replaces the entire original period/key set, not one row.
    const candidate = Buffer.from([lines[0], changed.join(','), ...lines.slice(2)].join('\n') + '\n');
    await page.getByLabel('Original synthetic CSV', { exact: false }).setInputFiles({ name: 'synthetic-correction.csv', mimeType: 'text/csv', buffer: candidate });
    await page.getByLabel('I confirm this file contains synthetic data only.', { exact: true }).check();
    await importButton.click();
    await page.getByRole('heading', { name: 'Correction review', exact: true }).waitFor();
    await page.getByLabel('Row disposition', { exact: true }).selectOption('rejected');
    const rejectedCsv = await exportCsv('Rejection CSV', page.getByRole('main'));
    assert.ok(rejectedCsv.includes('CONFLICTING_IDENTITY'));
    assert.ok(rejectedCsv.includes('row_values_json'));
    await page.getByRole('button', { name: 'Refresh review revision', exact: true }).click();
    await page.getByLabel('Review action', { exact: true }).selectOption('approve_supersession');
    await page.getByLabel('Review reason', { exact: false }).fill('Synthetic single-line correction reviewed against original source evidence.');
    await page.getByLabel('I reviewed this correction', { exact: false }).check();
    const reviewButton = page.getByRole('button', { name: 'Submit correction review', exact: true });
    await page.waitForFunction(() => !(Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Submit correction review') as HTMLButtonElement)?.disabled);
    // Another operator publishes: review must fail 409 rather than auto-refresh/retry.
    await upload(env, 'ebay', 'listing_sales', await file('incremental/ebay_sep01_2026.csv'), { startDate: '2026-09-01', endDate: '2026-09-30' });
    await reviewButton.click();
    await page.getByText('PUBLICATION_CHANGED', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Refresh review revision', exact: true }).click();
    assert.equal(await page.getByLabel('I reviewed this correction', { exact: false }).isChecked(), false);
    await page.getByLabel('I reviewed this correction', { exact: false }).check();
    await reviewButton.click();
    try { await page.getByText('Review recorded as', { exact: false }).waitFor(); }
    catch (error) { console.error('Review failed', { alerts: await page.getByRole('alert').allTextContents() }); throw error; }
    // A second explicit rejection must leave the approved publication unchanged.
    const secondChange = lines[2].split(',');
    secondChange[8] = (Number(secondChange[8]) + 1).toFixed(2);
    secondChange[13] = (Number(secondChange[13]) + 1).toFixed(2);
    await page.getByLabel('Original synthetic CSV', { exact: false }).setInputFiles({
      name: 'synthetic-rejected-correction.csv', mimeType: 'text/csv',
      buffer: Buffer.from([lines[0], changed.join(','), secondChange.join(','), ...lines.slice(3)].join('\n') + '\n'),
    });
    await page.getByLabel('I confirm this file contains synthetic data only.', { exact: true }).check();
    await importButton.click();
    await page.getByRole('heading', { name: 'Correction review', exact: true }).waitFor();
    await page.getByLabel('Review action', { exact: true }).selectOption('reject');
    await page.getByLabel('Review reason', { exact: false }).fill('Reject synthetic second-line replacement after reviewing preserved source evidence.');
    await page.getByLabel('I reviewed this correction', { exact: false }).check();
    await page.getByRole('button', { name: 'Submit correction review', exact: true }).click();
    await page.getByText('Review recorded as', { exact: false }).waitFor();
    await nav('Evidence');
    assert.ok((await page.getByRole('main').innerText()).includes(`Pinned publication: ${pinnedPublication}`));
    await nav('Reporting');
    await waitText('[data-testid="metric-net_item_sales"]', money(oracle.net_items.ebay + 100));
    await nav('Operations');
    await page.reload();
    await page.getByLabel('History source', { exact: true }).selectOption('ebay');
    await page.getByLabel('Batch state', { exact: true }).selectOption('superseded');
    await page.getByRole('button', { name: 'Inspect batch', exact: true }).first().waitFor();
    assert.ok((await page.getByRole('main').innerText()).includes('superseded'));
    await page.setViewportSize({ width: 390, height: 844 });
    await nav('Reporting');
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await mkdir('docs/goodwill/application/evidence', { recursive: true });
    await page.screenshot({ path: 'docs/goodwill/application/evidence/reporting-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: 'docs/goodwill/application/evidence/reporting-desktop.png', fullPage: true });
    outage = true;
    await figureSection().getByRole('button', { name: 'Refresh figure', exact: true }).click();
    await figureSection().getByText('Test service outage', { exact: false }).waitFor();
    assert.equal(await figureSection().locator('[data-testid]').count(), 0);
    denied = true;
    await figureSection().getByRole('button', { name: 'Retry', exact: true }).click();
    await figureSection().getByText('An authorized session is required', { exact: false }).waitFor();
    assert.equal(errors.length, 0, errors.join('\n'));
    assert.equal(requests.some(r => r.body?.sourceId === 'all'), false);
    await writeFile('docs/goodwill/application/evidence/browser-controls.json', JSON.stringify({
      synthetic: true, testOnlyRepositoryAndArchive: true, productionAuthBypass: false,
      acquisitionReplayVerifiedHere: false, controls, publicationPinVerified: true, staleReview409Verified: true,
      originalByteUploadVerified: true, mobileBodyOverflow: false, pageErrors: errors,
    }, null, 2) + '\n');
  } finally { await context.close(); await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});