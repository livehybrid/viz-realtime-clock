/*
 * Behaviour tests for the SHIPPED visualization.js (the hand-maintained
 * studio_visualization IIFE), not the React PoC in src/. Until these, the
 * artifact users run had no behaviour tests at all.
 *
 * The real code is driven through its real entry point: stub
 * DashboardExtensionAPI and #root, evaluate with new Function (jsdom context,
 * not vm), step requestAnimationFrame by hand. The digital readout is reached
 * through parentage (the canvas's next sibling's first child), a route the
 * code never navigates: it keeps its own references.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CODE = fs.readFileSync(path.join(__dirname, '..', 'visualization.js'), 'utf8');
// 14 Jul 2026 23:47:05 UTC is a Tuesday; in Kolkata (+05:30) it is already
// Wednesday 05:17:05; in New York (EDT, -04:00) it is 19:47:05.
const FIXED = Date.UTC(2026, 6, 14, 23, 47, 5);

let raf;
function boot(options) {
    document.body.innerHTML = '<div id="root"></div>';
    globalThis.DashboardExtensionAPI = { addOptionsListener: () => {}, getOptions: () => options };
    new Function(CODE)();
    raf.splice(0).forEach((cb) => cb(0));
    const canvas = document.querySelector('canvas');
    const info = canvas.nextElementSibling;
    return { canvas, root: canvas.parentElement, digital: info.children[0], date: info.children[1], step: () => raf.splice(0).forEach((cb) => cb(0)) };
}

beforeEach(() => {
    jest.useFakeTimers({ now: FIXED });
    raf = [];
    window.requestAnimationFrame = (cb) => { raf.push(cb); return raf.length; };
});
afterEach(() => {
    jest.useRealTimers();
    delete globalThis.DashboardExtensionAPI;
});

describe('time correctness at a fixed instant', () => {
    test('utc', () => {
        const c = boot({ timezone: 'utc' });
        expect(c.digital.textContent).toBe('23:47:05 UTC');
        expect(c.date.textContent).toBe('TUE 14 Jul 2026');
    });

    test('IANA zone with a half-hour offset crosses midnight correctly', () => {
        const c = boot({ timezone: 'Asia/Kolkata' });
        expect(c.digital.textContent).toBe('05:17:05 Kolkata');
        expect(c.date.textContent).toBe('WED 15 Jul 2026');
    });

    test('IANA zone in daylight saving time', () => {
        const c = boot({ timezone: 'America/New_York' });
        expect(c.digital.textContent).toBe('19:47:05 New York');
    });
});

describe('wrong-type options fall back to defaults', () => {
    test('a numeric timezone does not stop the clock', () => {
        const c = boot({ timezone: 42 });
        expect(c.digital.textContent).toMatch(/^\d\d:\d\d:\d\d$/);
        expect(raf.length).toBe(1); // the loop re-queued: the frame did not throw
    });

    test('numeric colours do not stop the clock', () => {
        const c = boot({ handColor: 123, tickColor: {}, secondHandColor: 7 });
        expect(raf.length).toBe(1);
        expect(c.digital.textContent).not.toBe('');
    });

    test('showDigital "false" hides the readout', () => {
        const c = boot({ showDigital: 'false', showDate: 'false' });
        expect(c.digital.style.display).toBe('none');
        expect(c.date.style.display).toBe('none');
    });

    test('UTC in capitals or with spaces is still UTC', () => {
        expect(boot({ timezone: ' UTC ' }).digital.textContent).toBe('23:47:05 UTC');
    });
});

describe('clockFaceColor', () => {
    test('the documented option is honoured (it was ignored)', () => {
        const c = boot({ clockFaceColor: '#123456' });
        expect(c.root.style.background).toBe('rgb(18, 52, 86)');
    });

    test('a non-string value keeps the default face', () => {
        const c = boot({ clockFaceColor: 5 });
        expect(c.root.style.background).toBe('rgb(5, 8, 16)');
    });
});
