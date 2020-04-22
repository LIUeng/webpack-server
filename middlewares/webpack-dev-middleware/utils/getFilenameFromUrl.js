'use strict';

/**
 * get filename from url
 */

const path = require('path');

module.exports = function getFilenameFromUrl(pubPath, compiler, url) {
    // console.log(path.resolve(compiler.outputPath, url));
    if(!pubPath) {
        pubPath = '/'
    }
    
    // return path.resolve(compiler.outputPath, url);
    // if(url == '/') {
    //     url = ''
    // } else {
    //     url = `/${url}`
    // }

    return path.posix.join(compiler.outputPath, url);
}