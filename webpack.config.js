const path = require('path');
// const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackPlugin = require('./plugins/html-webpack-plugin');

module.exports = {
    mode: 'development',

    // entry: ['./clients/index.js', './src/index.js'],
    entry: {
        client: './clients/index.js',
        app: './src/index.js',
    },

    output: {
        path: path.resolve(__dirname, 'build'),
        filename: '[name].js',
        publicPath: '/'
    },

    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, './public/index.html'),
        })
    ],

    resolve: {
        extensions: ['.js']
    },

    performance: false,
}