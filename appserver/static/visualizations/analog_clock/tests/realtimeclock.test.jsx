/*
 * Render tests for the RealtimeClock component (jsdom + canvas mock).
 * requestAnimationFrame is stubbed to run the draw loop exactly once per
 * render so assertions are deterministic and nothing leaks between tests.
 */
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import RealtimeClock from '../src/RealtimeClock';

const FIXED_NOW = new Date('2026-08-18T09:30:45Z').getTime();

let rafSpy;
let cancelSpy;

beforeEach(() => {
    jest.useFakeTimers({ now: FIXED_NOW });
    let ran = false;
    rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        if (!ran) {
            ran = true;
            cb(0);
        }
        return 42;
    });
    cancelSpy = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
    cleanup();
    rafSpy.mockRestore();
    cancelSpy.mockRestore();
    jest.useRealTimers();
});

describe('RealtimeClock rendering', () => {
    test('renders a canvas sized to the panel', () => {
        const { container } = render(<RealtimeClock width={300} height={300} />);
        const canvas = container.querySelector('canvas');
        expect(canvas).not.toBeNull();
        expect(canvas.style.width).toBe('300px'); // min(width,height), clamped at 40 minimum
    });

    test('defaults to local time (no UTC suffix) and shows digital + date', () => {
        const { container } = render(<RealtimeClock width={300} height={300} />);
        const infoDivs = container.querySelectorAll('div div div');
        const texts = Array.from(infoDivs).map((d) => d.textContent);
        const digital = texts.find((t) => /^\d\d:\d\d:\d\d/.test(t));
        expect(digital).toBeDefined();
        expect(digital.endsWith(' UTC')).toBe(false);
        expect(texts.some((t) => /^(SUN|MON|TUE|WED|THU|FRI|SAT) \d\d /.test(t))).toBe(true);
    });

    test('timezone utc renders the fixed instant with UTC suffix', () => {
        const { container } = render(
            <RealtimeClock width={300} height={300} options={{ timezone: 'utc' }} />
        );
        const texts = Array.from(container.querySelectorAll('div')).map((d) => d.textContent);
        expect(texts.some((t) => t === '09:30:45 UTC')).toBe(true);
    });

    test('showDigital and showDate both false removes the info block', () => {
        const { container } = render(
            <RealtimeClock width={300} height={300} options={{ showDigital: false, showDate: false }} />
        );
        const texts = Array.from(container.querySelectorAll('div')).map((d) => d.textContent);
        expect(texts.some((t) => /\d\d:\d\d:\d\d/.test(t))).toBe(false);
        expect(container.querySelector('canvas')).not.toBeNull();
    });

    test('applies server-time skew from the primary data source', () => {
        // Server reports one hour ahead of the fixed browser clock.
        const serverEpoch = (FIXED_NOW / 1000) + 3600;
        const { container } = render(
            <RealtimeClock
                width={300}
                height={300}
                options={{ timezone: 'utc' }}
                dataSources={{ primary: { data: { rows: [[String(serverEpoch)]] } } }}
            />
        );
        const texts = Array.from(container.querySelectorAll('div')).map((d) => d.textContent);
        expect(texts.some((t) => t === '10:30:45 UTC')).toBe(true);
    });

    test('cancels the animation frame on unmount', () => {
        const { unmount } = render(<RealtimeClock width={300} height={300} />);
        unmount();
        expect(cancelSpy).toHaveBeenCalledWith(42);
    });

    test('tiny panels still render without crashing', () => {
        const { container } = render(<RealtimeClock width={20} height={20} />);
        expect(container.querySelector('canvas')).not.toBeNull();
    });
});
