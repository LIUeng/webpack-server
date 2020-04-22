/**
 * use for webpack dev mode webpack dev middleware
 * how to write an express middleware
 * you can visit [http://expressjs.com/en/guide/using-middleware.html]
 */

const path = require('path');
const setupOutputFileSystem = require('./utils/setupOutputFileSystem');
const getFilenameFromUrl = require('./utils/getFilenameFromUrl');

module.exports = function wdm(compiler, options) {
    let context = {
        compiler,
        options,
    };
    // console.log('invoking');

    compiler.watch(
        {
            aggregateTimeout: 2000,
        },
        function(err) {
            if (err) return console.log(err);
        }
    );

    /* webpack output filesystem handle */
    setupOutputFileSystem(compiler, context);

    return function middleware(req, res, next) {
        return new Promise(resolve => {
            let filename = null;
            filename = getFilenameFromUrl(
                context.options.publicPath,
                context.compiler,
                req.url
            );
            if (!filename) return next();

            console.log('filename: ', filename);
            
            let index = '';
            if(req.url == '/') {
                index = '/index.html'
            }

            function processRequest() {
                // res end
                try {
                    let tpath = path.posix.join(filename, index);
                    let content = context.fs.readFileSync(tpath);
                    // console.log('content: ', content);
                    res.end(content);
                    resolve();
                } catch (err) {
                    if (err) return next();
                }
            }

            processRequest();
        });
    };
};
