'use strict';

/**
 * write a webpack plugin
 * example html-webpack-plugin
 */

const path = require('path');
const _ = require('lodash');
const vm = require('vm');
const { getHtmlWebpackPluginHooks } = require('./utils/hooks');
const childCompiler = require('./utils/compiler');

const defaultOptions = {
    inject: 'body',
    template: '',
    filename: 'index.html',
    title: 'LIUENG',
};

class HtmlWebpckPlugin {
    constructor(options) {
        this.options = Object.assign(defaultOptions, options);

        // child compiler cache
        this.childCompilerHash = undefined;
        this.childCompilationOutputName = undefined;
    }

    /**
     * apply required
     */
    apply(compiler) {
        const self = this;
        let compilationPromise;
        let isCompilationCached = false;

        this.options.template = this.getFullTemplatePath(
            this.options.template,
            compiler.context
        );

        // clear cache compiler
        childCompiler.clearCache(compiler);

        /* thisCompilation */
        compiler.hooks.thisCompilation.tap(
            'HtmlWebpackPlugin',
            (compilation) => {
                /* additional chunk assets */
                if (childCompiler.hasOutDatedTemplateCache(compilation)) {
                    childCompiler.clearCache(compiler);
                }
                childCompiler.addTemplateToCompiler(
                    compiler,
                    this.options.template
                );
                compilation.hooks.additionalChunkAssets.tap(
                    'HtmlWebpackPlugin',
                    () => {
                        const childCompilerDependencies = childCompiler.getFileDependencies(
                            compiler
                        );
                        childCompilerDependencies.forEach((fileDependency) => {
                            compilation.compilationDependencies.add(
                                fileDependency
                            );
                        });
                    }
                );
            }
        );

        /* make */
        compiler.hooks.make.tapAsync(
            'HtmlWebpackPlugin',
            (compilation, callback) => {
                compilationPromise = childCompiler
                    .compileTemplate(
                        self.options.template,
                        self.options.filename,
                        compilation
                    )
                    .catch((err) => {
                        return console.log(err);
                    })
                    .then((compilationResult) => {
                        // console.log('result: ', compilationResult);
                        isCompilationCached =
                            Boolean(compilationResult.hash) &&
                            self.childCompilerHash === compilationResult.hash;
                        self.childCompilerHash = compilationResult.hash;
                        self.childCompilationOutputName =
                            compilationResult.outputName;
                        callback();
                        return compilationResult.content;
                    });
            }
        );

        /* emit */
        compiler.hooks.emit.tapAsync(
            'HtmlWepackPlugin',
            (compilation, callback) => {
                // entry points
                const entryNames = Array.from(compilation.entrypoints.keys());
                const childCompilationOutputName =
                    self.childCompilationOutputName;

                // assets
                const assets = self.htmlWebpackPluginAssets(
                    compilation,
                    childCompilationOutputName,
                    entryNames
                );

                // generate tags
                const assetTagGroupsPromise = getHtmlWebpackPluginHooks(
                    compilation
                )
                    .alterAssetTags.promise({
                        assetTags: {
                            scripts: self.generatedScriptTags(assets.js),
                            styles: self.generatedStyleTags(assets.css),
                        },
                        outputName: childCompilationOutputName,
                        plugin: self,
                    })
                    .then(({ assetTags }) => {
                        const scriptTarget =
                            self.options.inject === 'head' ? 'head' : 'body';
                        const assetGroups = self.generateAssetGroups(
                            assetTags,
                            scriptTarget
                        );
                        return getHtmlWebpackPluginHooks(
                            compilation
                        ).alterAssetTagGroups.promise({
                            headTags: assetGroups.headTags,
                            bodyTags: assetGroups.bodyTags,
                            ouputName: childCompilationOutputName,
                            plugin: self,
                        });
                    });

                /**
                 * convert source to html
                 */
                const templateEvaluationPromise = compilationPromise.then(
                    (compiledTemplate) => {
                        return self.evaluateCompilationResult(
                            compilation,
                            compiledTemplate
                        );
                    }
                );

                const templateExectutionPromise = Promise.all([
                    assetTagGroupsPromise,
                    templateEvaluationPromise,
                ]).then(([assetTags, compilationResult]) => {
                    return typeof compilationResult !== 'function'
                        ? compilationResult
                        : self.executeTemplate(
                              compilationResult,
                              assets,
                              assetTags,
                              compilation
                          );
                });

                // inject script tag
                const injectedHtmlPromise = Promise.all([assetTagGroupsPromise, templateExectutionPromise]).then(([assetTags, html]) => {
                    const pluginArgs = {html, headTags: assetTags.headTags, bodyTags: assetTags.bodyTags, plugin: self, outputName: childCompilationOutputName};
                    return getHtmlWebpackPluginHooks(compilation).afterTemplateExecution.promise(pluginArgs);
                }).then(({html, headTags, bodyTags}) => {
                    // real inject html
                    return self.postProcessHtml(html, assets, {headTags, bodyTags});
                });

                const emitHtmlPromise = injectedHtmlPromise.then(html => {
                    const pluginArgs = {html, plugin: self, ouputName: childCompilationOutputName};
                    return getHtmlWebpackPluginHooks(compilation).beforeEmit.promise(pluginArgs).then(res => res.html)
                }).catch(err => {
                    return console.error('error: maybe emit html promise accurs error, please check it');
                }).then(html => {
                    const finalOutputName = childCompilationOutputName;
                    console.log('final', html, finalOutputName);
                    compilation.assets[finalOutputName] = {
                        source() {
                            return html;
                        },
                        size() {
                            return html.length;
                        }
                    };
                    return finalOutputName;
                }).then(finalOutputName => {
                    return getHtmlWebpackPluginHooks(compilation).afterEmit.promise({
                        outputName: finalOutputName,
                        plugin: self,
                    }).catch(err => {
                        console.error(err);
                        return null;
                    }).then(() => null);
                });

                emitHtmlPromise.then(() => {
                    callback();
                });
            }
        );
    }

    /**
     * get template path
     */
    getFullTemplatePath(template, context) {
        let loaderPath = path.resolve(__dirname, './utils/loader.js');
        if (~template.indexOf('!')) {
            return template;
        }
        // index.html loader
        return loaderPath + '!' + template;
    }

    /** */
    getTemplateParameters(compilation, assets, assetTags) {
        const options = this.options;
        return Promise.resolve().then(() =>
            templateParametersGenerator(compilation, assets, assetTags, options)
        );
    }

    /**
     * evaluate compilation result
     * @returns function
     */
    evaluateCompilationResult(compilation, source) {
        console.log('before result: ', source);
        if (!source) {
            return Promise.reject(
                new Error("The child compilation can't provide result")
            );
        }
        source = source.replace('var HTML_WEBPACK_PLUGIN_RESULT =', '');
        const template = this.options.template
            .replace(/^.+!/, '')
            .replace(/\?.+$/, '');

        console.log(template);
        const vmContext = vm.createContext(
            _.extend({ HTML_WEBPACK_PLUGIN: true, require: require }, global)
        );
        const vmScript = new vm.Script(source, { filename: template });

        let newSource;
        try {
            newSource = vmScript.runInContext(vmContext);
        } catch (error) {
            return Promise.reject(error);
        }

        if (typeof newSource === 'object' && newSource.__esModule && newSource.default) {
            newSource = newSource.default;
          }

        console.log('after new source: ', newSource);

        return typeof newSource === 'string' || typeof newSource === 'function'
            ? Promise.resolve(newSource)
            : Promise.reject(
                  new Error(
                      'The loader "' +
                          this.options.template +
                          '" didn\'t return html.'
                  )
              );
    }

    /**
     * execute template
     */
    executeTemplate(templateFunction, assets, assetTags, compilation) {
        const templateParamsPromise = this.getTemplateParameters(
            compilation,
            assets,
            assetTags
        );
        return templateParamsPromise.then((templateParams) => {
            try {
                return templateFunction(templateParams);
            } catch (error) {
                throw new Error('template params maybe have some errors');
            }
        });
    }

    /**
     * get html webpack plugin assets
     */
    htmlWebpackPluginAssets(
        compilation,
        childCompilationOutputName,
        entryNames
    ) {
        let extensionRegexp = /\.(css|js|mjs)(\?|$)/;

        // assets
        const assets = {
            js: [],
            css: [],
            publicPath: '/',
        };

        for (let i = 0; i < entryNames.length; i++) {
            const entryName = entryNames[i];
            const entryPointFiles = compilation.entrypoints
                .get(entryName)
                .getFiles();
            console.log(entryPointFiles);
            entryPointFiles.forEach((entryPointFile) => {
                const extMatch = extensionRegexp.exec(entryPointFile);
                if (!extMatch) {
                    return;
                }
                const ext = extMatch[1] === 'mjs' ? 'js' : extMatch[1];
                assets[ext].push(entryPointFile);
            });
        }
        // console.log('assets: ', assets);
        return assets;
    }

    /**
     * post process html
     */
    postProcessHtml(html, assets, assetTags) {
        console.log(assets, assetTags);
        const bodyRegx = /(<\/body\s*>)/;
        let injectHtml = '';
        if(this.options.inject) {
            if (assetTags.headTags.length) {}
            if (assetTags.bodyTags.length) {
                let assetBodyTags = assetTags.bodyTags;
                assetBodyTags.map(s => {
                    let attributes = s.attributes;
                    let attributeNames = Object.keys(attributes).map(key => `${key}="${attributes[key]}"`)
                    injectHtml += `<${s.tagName} ${attributeNames.join(' ')}></${s.tagName}>` + '\n';
                });
            }
        }

        console.log('inject html::::::', injectHtml);

        if(bodyRegx.test(html)) {
            html = html.replace(bodyRegx, match => {
                console.log('match', match);
                return match + injectHtml;
            });
        }

        console.log('html::::::', html, typeof html);

        return Promise.resolve(html);
    }

    /**
     * 
     * @param {object} assetTags {}
     * @param {string} scriptTarget body | head
     */
    generateAssetGroups (assetTags, scriptTarget) {
        /** @type {{ headTags: Array<HtmlTagObject>; bodyTags: Array<HtmlTagObject>; }} */
        const result = {
          headTags: [
            ...assetTags.styles
          ],
          bodyTags: []
        };
        // Add script tags to head or body depending on
        // the htmlPluginOptions
        if (scriptTarget === 'body') {
          result.bodyTags.push(...assetTags.scripts);
        } else {
          result.headTags.push(...assetTags.scripts);
        }
        return result;
      }

    /**
     * generate script tag
     */
    generatedScriptTags(jsAssets) {
        return jsAssets.map((jsAsset) => ({
            tagName: 'script',
            voidTag: false,
            attributes: {
                src: jsAsset,
            },
        }));
    }

    /**
     * generate style tag
     */
    generatedStyleTags(cssAssets) {
        return cssAssets.map((cssAsset) => ({
            tagName: 'style',
            voidTag: true,
            attributes: {
                rel: 'stylesheet',
                href: cssAsset,
            },
        }));
    }
}

function templateParametersGenerator(compilation, assets, assetTags, options) {
    return {
        compilation,
        webpackConfig: compilation.options,
        htmlWebpackPlugin: {
            tags: assetTags,
            files: assets,
            options,
        },
    };
}

module.exports = HtmlWebpckPlugin;
