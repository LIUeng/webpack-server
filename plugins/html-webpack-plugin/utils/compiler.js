'use strict';

const NodeTemplatePlugin = require('webpack/lib/node/NodeTemplatePlugin');
const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin');
const LoaderTargetPlugin = require('webpack/lib/LoaderTargetPlugin');
const LibraryTemplatePlugin = require('webpack/lib/LibraryTemplatePlugin');
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');

/**
 * use a child compiler not webpack main compiler
 * performance multi compiler
 */
class HtmlWebpackChildCompiler {
    constructor() {
        this.templates = [];
        this.compilationPromise = null;

        this.compilationStartedTimestamp = null;
        this.compilationEndedTimestamp = null;

        this.fileDependencies = [];
    }

    /**
     * add template only once
     */
    addTemplate(template) {
        let templateId = this.templates.indexOf(template);
        if (templateId !== -1) {
            return false;
        }
        if (this.isCompiling()) {
            throw new Error(
                'new templates can only be added before `compiliedTemplates` was called'
            );
        }
        this.templates.push(template);
        return true;
    }

    /**
     * return true if the child compiler is currently compiling
     *
     * @returns {boolean}
     */
    isCompiling() {
        return !this.didCompile() && this.compilationStartedTimestamp;
    }

    /**
     * return true if the child compiler is done compiling
     *
     * @returns {boolean}
     */
    didCompile() {
        return this.compilationEndedTimestamp;
    }

    /**
     * compile templates
     * start compilation once it is started no more templates can be added
     */
    compileTemplates(mainCompilation) {
        if (this.compilationPromise) {
            return this.compilationPromise;
        }
        const outputOptions = {
            filename: '__child-[name]',
            publicPath: mainCompilation.outputOptions.publicPath,
        };

        // create child compiler
        let compilerName = 'HtmlWebpackCompiler';
        const childCompiler = mainCompilation.createChildCompiler(
            compilerName,
            outputOptions
        );
        childCompiler.context = mainCompilation.compiler.context;


        // compile the template to nodejs javascript
        new NodeTemplatePlugin(outputOptions).apply(childCompiler);
        new NodeTargetPlugin().apply(childCompiler);
        new LibraryTemplatePlugin('HTML_WEBPACK_PLUGIN_RESULT', 'var').apply(
            childCompiler
        );
        new LoaderTargetPlugin('node').apply(childCompiler);

        // console.log('this templates: ', this.templates);
        this.templates.forEach((template, idx) => {
            new SingleEntryPlugin(
                childCompiler.context,
                template,
                `HtmlWepbackPlugin_${idx}`
            ).apply(childCompiler);
        });
        this.compilationStartedTimestamp = new Date().getTime();

        // compilation promise
        this.compilationPromise = new Promise((resolve, reject) => {
            childCompiler.runAsChild((err, entries, childCompilation) => {
                // console.log('entries', entries)
                // extract tamplates
                const compiledTemplates = entries
                    ? extractHelperFilesFromCompilation(
                          mainCompilation,
                          childCompilation,
                          outputOptions.filename,
                          entries
                      )
                    : [];
                if (entries) {
                    this.fileDependencies = Array.from(
                        childCompilation.fileDependencies
                    );
                }

                // Reject the promise if the childCompilation contains error
                if (
                    childCompilation &&
                    childCompilation.errors &&
                    childCompilation.errors.length
                ) {
                    const errorDetails = childCompilation.errors
                        .map(
                            error =>
                                error.message +
                                (error.error ? ':\n' + error.error : '')
                        )
                        .join('\n');
                    reject(
                        new Error('Child compilation failed:\n' + errorDetails)
                    );
                    return;
                }
                // Reject if the error object contains errors
                if (err) {
                    reject(err);
                    return;
                }

                const result = {};
                compiledTemplates.map((templateSource, idx) => {
                    result[this.templates[idx]] = {
                        content: templateSource,
                        hash: childCompilation.hash,
                        entry: entries[idx],
                    };
                });
                this.compilationEndedTimestamp = new Date().getTime();
                resolve(result);
            });
        });

        return this.compilationPromise;
    }
}

/**
 * extract helper files from compilation
 */
function extractHelperFilesFromCompilation(
    mainCompilation,
    childCompilation,
    filename,
    childEntryChunk
) {
    const helperAssetNames = childEntryChunk.map((entryChunk, idx) => {
        return mainCompilation.mainTemplate.getAssetPath(filename, {
            hash: childCompilation.hash,
            chunk: entryChunk,
            name: `HtmlWepbackPlugin_${idx}`,
        });
    });

    // delete main compilation assets
    helperAssetNames.forEach(name => {
        delete mainCompilation.assets[name];
    });

    const helperContent = helperAssetNames.map(name => {
        return childCompilation.assets[name].source();
    });

    return helperContent;
}

/**
 * child compiler cache handle
 */
const childCompilerCache = new WeakMap();

function getChildCompiler(mainCompiler) {
    const cacheChildCompiler = childCompilerCache.get(mainCompiler);
    if (cacheChildCompiler) {
        return cacheChildCompiler;
    }
    const newCompiler = new HtmlWebpackChildCompiler();
    childCompilerCache.set(mainCompiler, newCompiler);
    return newCompiler;
}

/**
 * clear the childcompiler from the cache
 */
function clearCache(mainCompiler) {
    const childCompiler = getChildCompiler(mainCompiler);
    if (childCompiler.isCompiling() || childCompiler.didCompile()) {
        childCompilerCache.delete(mainCompiler);
    }
}

/**
 * resigter a template for the current main compiler
 */
function addTemplateToCompiler(mainComplier, templatePath) {
    const childCompiler = getChildCompiler(mainComplier);
    const isNew = childCompiler.addTemplate(templatePath);
    if (isNew) {
        clearCache(mainComplier);
    }
}

/**
 * compile templates
 * if this function is called multi times it will use cache inside
 */
function compileTemplate(templatePath, outputFilename, mainCompilation) {
    const childCompiler = getChildCompiler(mainCompilation.compiler);
    return childCompiler
        .compileTemplates(mainCompilation)
        .then(compiledTemplates => {
            if (!compiledTemplates[templatePath]) {
                console.log(Object.keys(compiledTemplates), templatePath);
            }
            const compiledTemplate = compiledTemplates[templatePath];
            const outputName = mainCompilation.mainTemplate.getAssetPath(
                outputFilename,
                {
                    hash: compiledTemplate.hash,
                    entry: compiledTemplate.entry,
                }
            );
            return {
                outputName,
                hash: compiledTemplate.hash,
                content: compiledTemplate.content,
            };
        });
}

/**
 * get file dependcies
 */
function getFileDependencies(compiler) {
    const childCompiler = getChildCompiler(compiler);
    return childCompiler.fileDependencies;
}

/**
 * outdated compilation file dependcies handle
 */
const hasOutDatedCompilationDependenciesMap = new WeakMap();

// has outdated template cache
function hasOutDatedTemplateCache(mainCompilation) {
    const childCompiler = getChildCompiler(mainCompilation.compiler);
    let hasOutDatedChildCompilerDependenciesMap = hasOutDatedCompilationDependenciesMap.get(
        mainCompilation
    );
    if (!hasOutDatedChildCompilerDependenciesMap) {
        hasOutDatedChildCompilerDependenciesMap = new WeakMap();
        hasOutDatedCompilationDependenciesMap.set(
            mainCompilation,
            hasOutDatedChildCompilerDependenciesMap
        );
    }
    let isOutDated = hasOutDatedChildCompilerDependenciesMap.get(childCompiler);
    if (isOutDated) {
        return isOutDated;
    }
    isOutDated = isChildCompilerOutDated(mainCompilation, childCompiler);
    hasOutDatedChildCompilerDependenciesMap.set(childCompiler, isOutDated);
    return isOutDated;
}

/**
 * check child compiler is outdated
 */
function isChildCompilerOutDated(mainCompilation, childCompiler) {
    if (!childCompiler.compilationStartedTimestamp) {
        return false;
    }
    let fileTimestamps = mainCompilation.fileTimestamps;
    let isCacheOutOfDate = childCompiler.fileDependencies.some(fileDependency => {
        let timestamps = fileTimestamps.get(fileDependency);
        return (
            !timestamps ||
            timestamps > childCompiler.compilationStartedTimestamp
        );
    });
    return isCacheOutOfDate;
}

module.exports = {
    hasOutDatedTemplateCache,
    getFileDependencies,
    compileTemplate,
    clearCache,
    addTemplateToCompiler,
};
