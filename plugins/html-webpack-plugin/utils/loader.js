'use strict';

const _ = require('lodash');

/**
 * write a webpack loader
 */
module.exports = function htmlWebpackPluginLoader(source) {
    // array like
    const template = _.template(source, _.defaults({
        interpolate: /<%=([\s\S]+?)%>/g,
        variable: 'data',
    }));
    console.log('here: ', template);
    return (
        'var _ = __non_webpack_require__(' +
        JSON.stringify(require.resolve('lodash')) +
        ');' +
        'module.exports = function (templateParams) { with(templateParams) {' +
        'return (' +
        template.source +
        ')();' +
        '}}'
    );
};
