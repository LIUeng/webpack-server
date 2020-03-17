'use strict';

const config = require('../webpack.config');
const webpack = require('webpack');
const Server = require('../servers/Server');

/**
 * defaule example
 */
let defaultOptions = {
    host: 'localhost',
    port: 9999,
    protocol: 'http',
};

/**
 * webpack config start
 */
try {
    let compiler = webpack(config);
    let server = new Server(compiler, {});

    server.listen(defaultOptions.port, defaultOptions.host, function(err) {
        if (err) {
            return console.log(err);
        }
        console.log();
        console.log(
            '启动成功：',
            `${defaultOptions.protocol}://${defaultOptions.host}:${defaultOptions.port}`
        );
    });
} catch (err) {
    if (err) console.log(err);
    process.exit(1);
}
