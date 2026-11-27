/*
 * Time-correctness and option scenarios for the Realtime Clock on a real
 * Splunk, in Dashboard Studio (Studio-only viz: no Simple XML leg).
 *
 * The browser clock is pinned with Playwright's clock API to
 * 2026-07-14T23:47:05Z (a Tuesday). Expected readings are written out by
 * hand for each zone, not computed with the same Date calls the viz makes.
 * Hand angles come from a recorder that wraps CanvasRenderingContext2D
 * rotate() in every frame; the digital readout is reached through parentage
 * (the canvas's next sibling's first child), which the viz never navigates.
 */
const { test, expect, request } = require('@playwright/test');

const MGMT_URL = process.env.SPLUNK_MGMT_URL || 'https://localhost:8089';
const USER = process.env.SPLUNK_USER || 'admin';
const PASS = process.env.SPLUNK_PASSWORD || 'Changeme1!';
const APP = 'viz-realtime-clock';
const HOST_APP = APP; // where the existing clock_e2e dashboard lives

const FIXED = new Date('2026-07-14T23:47:05.000Z');
const LATER = new Date('2026-07-14T23:59:58.000Z');

function clockDashboard(title, options, withData) {
    return {
        version: '2',
        title,
        dataSources: withData ? { ds: { type: 'ds.search', options: { query: withData } } } : {},
        visualizations: {
            viz_clock: {
                type: `${APP}.analog_clock`,
                ...(withData ? { dataSources: { primary: 'ds' } } : {}),
                options,
                title,
            },
        },
        inputs: {},
        defaults: {},
        layout: {
            type: 'grid', options: {},
            structure: [{ item: 'viz_clock', type: 'block', position: { x: 0, y: 0, w: 600, h: 500 } }],
        },
    };
}

const VIEWS = {
    clock_e2e_utc: clockDashboard('Clock UTC', { timezone: 'utc' }),
    clock_e2e_local: clockDashboard('Clock local', { timezone: 'local' }),
    clock_e2e_ny: clockDashboard('Clock New York', { timezone: 'America/New_York' }),
    clock_e2e_badopts: clockDashboard('Clock bad options', {
        timezone: 42, handColor: 123, tickColor: { a: 1 }, secondHandColor: 7,
        showDigital: 'false', showDate: 'false', showGlow: 'nope',
    }),
    clock_e2e_face: clockDashboard('Clock face colour', { timezone: 'utc', clockFaceColor: '#123456' }),
    clock_e2e_empty: clockDashboard('Clock empty data', { timezone: 'utc' }, '| makeresults | where 1=0'),
};

const RECORDER = () => {
    const P = window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype;
    if (!P || P.__e2eWrapped) return;
    P.__e2eWrapped = true;
    const cur = [];
    const rec = { last: null, count: 0, errors: [] };
    Object.defineProperty(window, '__clockRec', { value: rec });
    window.addEventListener('error', (e) => rec.errors.push(String(e.message)));
    const { clearRect, rotate } = P;
    P.clearRect = function (x, y, ...rest) {
        if (x === 0 && y === 0) { rec.last = cur.splice(0); rec.count++; }
        return clearRect.call(this, x, y, ...rest);
    };
    P.rotate = function (a) { cur.push(a); return rotate.call(this, a); };
};

test.beforeAll(async () => {
    const api = await request.newContext({
        baseURL: MGMT_URL, ignoreHTTPSErrors: true, httpCredentials: { username: USER, password: PASS },
    });
    for (const [name, def] of Object.entries(VIEWS)) {
        const xml = `<dashboard version="2" theme="dark"><label>${def.title}</label>` +
            `<definition><![CDATA[${JSON.stringify(def)}]]></definition></dashboard>`;
        const create = await api.post(`/servicesNS/${USER}/${HOST_APP}/data/ui/views?output_mode=json`, { form: { name, 'eai:data': xml } });
        if (!create.ok()) {
            const update = await api.post(`/servicesNS/${USER}/${HOST_APP}/data/ui/views/${name}?output_mode=json`, { form: { 'eai:data': xml } });
            if (!update.ok()) throw new Error(`could not create/update ${name}: ${update.status()} ${await update.text()}`);
        }
    }
    await api.dispose();
});

async function openClock(page, view) {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(RECORDER);
    await page.goto('/en-GB/account/login');
    await page.fill('input[name="username"]', USER);
    await page.fill('input[name="password"]', PASS);
    await page.press('input[name="password"]', 'Enter');
    await page.waitForURL((u) => /^\/[^/]+\/(app|launcher|home)\b/.test(new URL(u).pathname), { timeout: 60000 });
    // Date is pinned; timers keep running so requestAnimationFrame still ticks.
    await page.clock.setFixedTime(FIXED);
    await page.goto(`/en-GB/app/${HOST_APP}/${view}`);
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
        for (const f of page.frames()) {
            if (f === page.mainFrame()) continue;
            try {
                if (await f.$('canvas')) {
                    if (!(await f.evaluate(() => !!window.__clockRec))) throw new Error('canvas recorder not installed in the viz frame');
                    await expect.poll(() => f.evaluate(() => window.__clockRec.count), { timeout: 30000 }).toBeGreaterThan(2);
                    return { frame: f, vizErrors: () => errors.filter((e) => /analog_clock|visualization\.js/.test(e)) };
                }
            } catch (e) { if (/recorder|Timed out|toBeGreaterThan/.test(e.message)) throw e; }
        }
        await page.waitForTimeout(2000);
    }
    throw new Error(`no clock canvas in any viz frame of ${view}`);
}

// Digital readout and date line, reached through parentage.
const readout = (clock) => clock.frame.evaluate(() => {
    const info = document.querySelector('canvas').nextElementSibling;
    const vis = (el) => el && getComputedStyle(el).display !== 'none' && getComputedStyle(info).display !== 'none';
    return {
        time: info.children[0].textContent, date: info.children[1].textContent,
        timeShown: vis(info.children[0]), dateShown: vis(info.children[1]),
    };
});

const deg = (h, m, s) => ({
    hour: ((h % 12) + m / 60 + s / 3600) * 30 - 90,
    minute: (m + s / 60) * 6 - 90,
    second: s * 6 - 90,
});

async function expectHands(clock, want) {
    const rot = await clock.frame.evaluate(() => window.__clockRec.last);
    expect(rot, 'three hands rotated per frame').toHaveLength(3);
    const got = rot.map((r) => (r * 180) / Math.PI);
    expect(got[0]).toBeCloseTo(want.hour, 1);
    expect(got[1]).toBeCloseTo(want.minute, 1);
    expect(got[2]).toBeCloseTo(want.second, 1);
}

test('utc: readout, date and hands match the pinned instant', async ({ page }) => {
    const clock = await openClock(page, 'clock_e2e_utc');
    await expect.poll(() => readout(clock).then((r) => r.time), { timeout: 30000 }).toBe('23:47:05 UTC');
    expect((await readout(clock)).date).toBe('TUE 14 Jul 2026');
    await expectHands(clock, deg(23, 47, 5));
    expect(clock.vizErrors()).toEqual([]);
});

test.describe('browser in Asia/Kolkata (UTC+05:30)', () => {
    test.use({ timezoneId: 'Asia/Kolkata' });

    test('local: the half-hour offset and the date roll-over are right', async ({ page }) => {
        const clock = await openClock(page, 'clock_e2e_local');
        await expect.poll(() => readout(clock).then((r) => r.time), { timeout: 30000 }).toBe('05:17:05');
        expect((await readout(clock)).date).toBe('WED 15 Jul 2026');
        await expectHands(clock, deg(5, 17, 5));
        expect(clock.vizErrors()).toEqual([]);
    });

    test('an IANA zone option wins over the browser zone (New York, EDT)', async ({ page }) => {
        const clock = await openClock(page, 'clock_e2e_ny');
        await expect.poll(() => readout(clock).then((r) => r.time), { timeout: 30000 }).toBe('19:47:05 New York');
        expect((await readout(clock)).date).toBe('TUE 14 Jul 2026');
        await expectHands(clock, deg(19, 47, 5));
    });
});

test('the clock follows time forward, not just the first render', async ({ page }) => {
    const clock = await openClock(page, 'clock_e2e_utc');
    await expect.poll(() => readout(clock).then((r) => r.time), { timeout: 30000 }).toBe('23:47:05 UTC');
    await page.clock.setFixedTime(LATER);
    await expect.poll(() => readout(clock).then((r) => r.time), { timeout: 30000 }).toBe('23:59:58 UTC');
    await expectHands(clock, deg(23, 59, 58));
});

test('wrong-type options fall back to defaults and the clock keeps running', async ({ page }) => {
    const clock = await openClock(page, 'clock_e2e_badopts');
    const before = await clock.frame.evaluate(() => window.__clockRec.count);
    await page.waitForTimeout(1500);
    const rec = await clock.frame.evaluate(() => ({ count: window.__clockRec.count, errors: window.__clockRec.errors, last: window.__clockRec.last }));
    expect(rec.errors).toEqual([]);
    expect(rec.count).toBeGreaterThan(before);
    expect(rec.last).toHaveLength(3); // hands still drawn
    const r = await readout(clock);
    expect(r.timeShown).toBe(false); // showDigital "false"
    expect(r.dateShown).toBe(false); // showDate "false"
    expect(clock.vizErrors()).toEqual([]);
});

test('clockFaceColor is honoured', async ({ page }) => {
    const clock = await openClock(page, 'clock_e2e_face');
    const bg = await clock.frame.evaluate(() => getComputedStyle(document.querySelector('canvas').parentElement).backgroundColor);
    expect(bg).toBe('rgb(18, 52, 86)');
});

// Platform behaviour, pinned: when a bound search returns zero rows, Studio
// swaps the panel for its no-results placeholder and never mounts the viz,
// even though the clock does not use the data. The README says not to bind a
// search that can come back empty.
test('an empty data source: Studio shows its placeholder instead of the clock', async ({ page }) => {
    let dispatched = false;
    page.on('request', (r) => {
        if (r.method() === 'POST' && /\/search\/(v2\/)?jobs(\?|$)/.test(r.url()) && (r.postData() || '').includes('where')) dispatched = true;
    });
    await page.goto('/en-GB/account/login');
    await page.fill('input[name="username"]', USER);
    await page.fill('input[name="password"]', PASS);
    await page.press('input[name="password"]', 'Enter');
    await page.waitForURL((u) => /^\/[^/]+\/(app|launcher|home)\b/.test(new URL(u).pathname), { timeout: 60000 });
    await page.goto(`/en-GB/app/${HOST_APP}/clock_e2e_empty`);
    await expect.poll(() => dispatched, { timeout: 60000 }).toBe(true);
    await page.waitForTimeout(15000);
    for (const f of page.frames()) {
        if (f === page.mainFrame()) continue;
        expect(await f.$('canvas').catch(() => null)).toBeNull();
    }
});
