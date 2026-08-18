/*
 * Jest config for the Realtime Clock viz.
 *
 * Babel options are inlined here (not a babel.config.js) so the webpack build,
 * which passes its own inline options to babel-loader, cannot pick up a config
 * file and double-apply presets.
 */
module.exports = {
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/tests'],
    setupFiles: ['jest-canvas-mock'],
    transform: {
        '^.+\\.(js|jsx)$': [
            'babel-jest',
            {
                presets: [
                    ['@babel/preset-env', { targets: { node: 'current' } }],
                    ['@babel/preset-react', { runtime: 'classic' }],
                ],
            },
        ],
    },
    moduleFileExtensions: ['js', 'jsx', 'json'],
};
