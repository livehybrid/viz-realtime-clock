/*
 * Guard: the packaged visualization.js must remain the hand-maintained
 * studio_visualization artifact. The React/webpack source in src/ is a
 * future-port PoC — its build output silently fails to mount in the Studio
 * sandbox (discovered 2026-08-18 after it shipped in release tarballs).
 */
const fs = require('fs');
const path = require('path');

const bundle = fs.readFileSync(path.join(__dirname, '..', 'visualization.js'), 'utf8');

describe('packaged visualization.js artifact', () => {
    test('is the studio_visualization implementation, not the webpack PoC build', () => {
        expect(bundle).toContain('studio_visualization');
        expect(bundle).not.toMatch(/^define\(\["react"\]/);
    });

    test('implements the working module surface', () => {
        expect(bundle).toContain('clockFaceColor');
        expect(bundle).toContain('requestAnimationFrame');
    });
});
