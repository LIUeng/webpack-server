/**
 * webpack output file system
 * use memory-fs
 */

const MemoryFileSystem = require('memory-fs');

module.exports = function setOutputFileSystem(compiler, context) {
    // handle simplify
    let fileSystem = null;
    fileSystem = new MemoryFileSystem();
    compiler.outputFileSystem = fileSystem;
    context.fs = fileSystem;
};
