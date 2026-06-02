/*
 * Realtime Clock — Splunk Dashboard Studio viz definition
 *
 * This is the entry point for the new Dashboard Studio custom viz framework.
 * It exports the viz definition object consumed by Dashboard Studio to register
 * the visualisation, define its data contract, and supply the React component.
 *
 * Dashboard Studio loads this module via AMD (RequireJS) after webpack bundles
 * it to visualization.js. React and react-dom are externals — Dashboard Studio
 * provides them from its own bundle.
 */

import RealtimeClock from './RealtimeClock';

const definition = {
    name: 'analog_clock',
    title: 'Realtime Clock',
    description: 'Real-time analog clock with aviation-themed dark aesthetic. Runs at 60 fps via requestAnimationFrame. Built for AirspaceWatch.',

    // Tells Dashboard Studio how to request data for this viz.
    // A single row with _time is all we need for server-time skew correction.
    dataContract: {
        initialRequestParams: {
            offset: 0,
            count: 1,
        },
    },

    // JSON-schema-style option definitions — used by the Dashboard Studio
    // "Configuration" panel to build the editor UI.
    optionsSchema: {
        clockFaceColor:  { type: 'string',  default: '#050810', title: 'Face Color' },
        handColor:       { type: 'string',  default: '#6aa3f8', title: 'Hand Color' },
        secondHandColor: { type: 'string',  default: '#00d4aa', title: 'Second Hand Color' },
        tickColor:       { type: 'string',  default: '#00d4aa', title: 'Tick Color' },
        showDigital:     { type: 'boolean', default: true,      title: 'Show Digital Time' },
        showDate:        { type: 'boolean', default: true,      title: 'Show Date' },
        showGlow:        { type: 'boolean', default: true,      title: 'Glow Effect' },
        timezone:        { type: 'string',  default: 'utc',     title: 'Timezone', enum: ['local', 'utc'] },
    },

    // Default panel definition — copied into the dashboard JSON when the user
    // drags this viz onto a dashboard for the first time.
    default: {
        title: 'Mission Clock',
        dataSources: { primary: 'primary_ds' },
        options: {
            clockFaceColor:  '#050810',
            handColor:       '#6aa3f8',
            secondHandColor: '#00d4aa',
            tickColor:       '#00d4aa',
            showDigital:     true,
            showDate:        true,
            showGlow:        true,
            timezone:        'utc',
        },
    },

    // The React component Dashboard Studio renders inside the panel.
    visualization: RealtimeClock,
};

export default definition;
