/*
 * End-to-end render check: the packaged app, installed on a real Splunk,
 * renders the Realtime Clock inside a Dashboard Studio dashboard in a real
 * (headless) browser.
 *
 * The Studio dashboard is created via REST in beforeAll. Gotchas encoded here
 * (learned on AirspaceWatch): viz `type` is `<app-dir>.<viz-folder>` with NO
 * `splunk.` prefix, and the dashboard XML wrapper needs version="2".
 */
const { test, expect, request } = require('@playwright/test');

const MGMT_URL = process.env.SPLUNK_MGMT_URL || 'https://localhost:8089';
const USER = process.env.SPLUNK_USER || 'admin';
const PASS = process.env.SPLUNK_PASSWORD || 'Changeme1!';
const APP = 'viz-realtime-clock';
const VIEW = 'clock_e2e';

const definition = {
    version: '2',
    title: 'Clock E2E',
    description: 'Playwright render check for the Realtime Clock viz',
    dataSources: {
        primary_ds: {
            type: 'ds.search',
            options: { query: '| makeresults | eval t=_time | table t' },
            name: 'server time',
        },
    },
    visualizations: {
        viz_clock: {
            type: `${APP}.analog_clock`,
            dataSources: { primary: 'primary_ds' },
            options: { timezone: 'utc' },
            title: 'Mission Clock',
        },
    },
    inputs: {},
    defaults: {},
    layout: {
        type: 'grid',
        options: {},
        structure: [
            { item: 'viz_clock', type: 'block', position: { x: 0, y: 0, w: 600, h: 500 } },
        ],
    },
};

const DASHBOARD_XML =
    `<dashboard version="2" theme="dark"><label>Clock E2E</label>` +
    `<definition><![CDATA[${JSON.stringify(definition)}]]></definition></dashboard>`;

test.beforeAll(async () => {
    const api = await request.newContext({
        baseURL: MGMT_URL,
        ignoreHTTPSErrors: true,
        httpCredentials: { username: USER, password: PASS },
    });
    // Create, or update if a previous run left it behind.
    const create = await api.post(`/servicesNS/${USER}/${APP}/data/ui/views?output_mode=json`, {
        form: { name: VIEW, 'eai:data': DASHBOARD_XML },
    });
    if (!create.ok()) {
        const update = await api.post(
            `/servicesNS/${USER}/${APP}/data/ui/views/${VIEW}?output_mode=json`,
            { form: { 'eai:data': DASHBOARD_XML } }
        );
        if (!update.ok()) {
            throw new Error(
                `could not create/update dashboard: ${create.status()} then ${update.status()}: ${await update.text()}`
            );
        }
    }
    await api.dispose();
});

test('Realtime Clock renders on a Studio dashboard', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Splunk web form login
    await page.goto('/en-GB/account/login');
    await page.fill('input[name="username"]', USER);
    await page.fill('input[name="password"]', PASS);
    await page.press('input[name="password"]', 'Enter');
    await page.waitForURL(/\/(app|launcher|home)/, { timeout: 60000 });

    // Open the dashboard and wait for the viz to draw
    await page.goto(`/en-GB/app/${APP}/${VIEW}`);
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120000 });

    // The digital readout proves the animation loop ran, not just the mount
    await expect(page.getByText(/\d\d:\d\d:\d\d UTC/).first()).toBeVisible({ timeout: 60000 });

    // Render proof artifact
    await page.screenshot({ path: 'e2e-results/clock-render.png' });

    // Surface (but tolerate) console noise; hard-fail only on our own module
    const vizErrors = consoleErrors.filter((e) => /analog_clock|visualization\.js/.test(e));
    console.log(`console errors total=${consoleErrors.length}, viz-specific=${vizErrors.length}`);
    expect(vizErrors).toEqual([]);
});
