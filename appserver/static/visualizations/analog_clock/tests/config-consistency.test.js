/*
 * Drift guard: config.json (the manifest Dashboard Studio's editor reads)
 * must agree with the definition module (src/index.js). This test exists
 * because they HAD drifted (timezone default utc vs local, clockFaceColor
 * missing from the editor) — caught during the 2026-08 test retrofit.
 */
import definition from '../src/index';
const config = require('../config.json');

describe('config.json vs definition consistency', () => {
    const configSchema = config.config.optionsSchema;
    const defSchema = definition.optionsSchema;

    test('every editor-exposed option exists in the definition schema', () => {
        for (const key of Object.keys(configSchema)) {
            expect(defSchema).toHaveProperty(key);
        }
    });

    test('defaults agree wherever both declare one', () => {
        for (const [key, spec] of Object.entries(configSchema)) {
            if (spec.default === undefined || defSchema[key]?.default === undefined) continue;
            expect({ key, default: spec.default }).toEqual({ key, default: defSchema[key].default });
        }
    });

    test('every editorConfig row points at a declared option', () => {
        const declared = new Set(Object.keys(configSchema));
        for (const section of config.config.editorConfig) {
            for (const row of section.layout) {
                for (const cell of row) {
                    expect(declared.has(cell.option)).toBe(true);
                }
            }
        }
    });

    test('types agree between manifest and definition', () => {
        for (const [key, spec] of Object.entries(configSchema)) {
            if (defSchema[key]?.type) {
                expect({ key, type: spec.type }).toEqual({ key, type: defSchema[key].type });
            }
        }
    });
});
