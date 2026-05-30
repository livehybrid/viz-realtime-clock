/*
 * Webpack config for the Realtime Clock Splunk Dashboard Studio custom visualization.
 *
 * Dashboard Studio loads the built file as an AMD module via RequireJS.
 * React and react-dom are provided by Dashboard Studio's own bundle, so they
 * are declared as externals — this keeps the output small and avoids version
 * conflicts.
 *
 * Entry:  src/index.js  (exports the viz definition object)
 * Output: ./visualization.js  (AMD module, one folder up from src/)
 */

const path = require('path');

module.exports = {
    mode: 'production',
    entry: path.resolve(__dirname, 'src', 'index.js'),
    output: {
        filename: 'visualization.js',
        path: path.resolve(__dirname),
        libraryTarget: 'amd',
    },
    externals: [
        'react',
        'react-dom',
        'prop-types',
        '@splunk/dashboard-core',
        '@splunk/dashboard-context',
        '@splunk/themes',
    ],
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', { targets: '> 0.25%, not dead' }],
                            ['@babel/preset-react', { runtime: 'classic' }],
                        ],
                    },
                },
            },
        ],
    },
    resolve: {
        extensions: ['.js', '.jsx'],
    },
    performance: {
        hints: false,
    },
};
