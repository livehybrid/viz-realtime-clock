/*
 * Contract tests for the Dashboard Studio viz definition (src/index.js).
 * These pin the public surface Studio consumes: name, options schema,
 * defaults and the data contract.
 */
import definition from '../src/index';
import RealtimeClock from '../src/RealtimeClock';

describe('viz definition contract', () => {
    test('registers under the expected name', () => {
        expect(definition.name).toBe('analog_clock');
    });

    test('exposes the React component', () => {
        expect(definition.visualization).toBe(RealtimeClock);
        expect(typeof definition.visualization).toBe('function');
    });

    test('data contract requests a single row (server-time skew source)', () => {
        expect(definition.dataContract.initialRequestParams).toEqual({ offset: 0, count: 1 });
    });

    test('options schema covers every option the component understands', () => {
        expect(Object.keys(definition.optionsSchema).sort()).toEqual([
            'clockFaceColor',
            'handColor',
            'secondHandColor',
            'showDate',
            'showDigital',
            'showGlow',
            'tickColor',
            'timezone',
        ]);
    });

    test('default panel options agree with the schema defaults, except the deliberate utc panel default', () => {
        const schemaDefaults = Object.fromEntries(
            Object.entries(definition.optionsSchema).map(([k, v]) => [k, v.default])
        );
        const panel = definition.default.options;
        for (const [key, value] of Object.entries(panel)) {
            if (key === 'timezone') continue; // panel deliberately ships utc (Mission Clock)
            expect({ key, value }).toEqual({ key, value: schemaDefaults[key] });
        }
        expect(panel.timezone).toBe('utc');
    });
});
