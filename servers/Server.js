'use strict';

const http = require('http');
const SockJsServer = require('./SockJsServer');
const express = require('express');
// const webpackDevMiddleware = require('../middlewares/webpack-dev-middleware');
const webpackDevMiddleware = require('webpack-dev-middleware');

/**
 * server p
 */
class Server {
    constructor(compiler, options) {
        this.compiler = compiler;
        this.options = options;
        // use express
        this.app = express();

        this.setupHooks();
        this.setupRoutes();
        this.setupMiddleware();
        this.setupStaticFeatrue();

        // this.listenApp = null;
        this.sockPath = '/sockjs-node';
        this.createServer();
        this.sockets = [];
    }

    /**
     * routes
     */
    setupRoutes() {
        // this.app.use(express.static('./public'));
    }

    /**
     * webpack hooks
     */
    setupHooks() {
        // compiler hooks
        this.compiler.hooks.done.tap('dev-server', (stats) => {
            console.log();
            console.log('DONE');
            console.log();
            this._sendStatus(this.sockets, stats);
        });
    }

    /**
     * express middleware
     */
    setupMiddleware() {
        this.middleware = webpackDevMiddleware(this.compiler, {
            logLevel: 'error',
        });
        this.app.use(this.middleware);
    }

    /**
     * static public
     */
    setupStaticFeatrue() {
        this.app.use('/', express.static('./public'));
    }

    /* http server */
    createServer() {
        /**
         * only support http server here example
         * https need SSL cert | http2
         * If you want, you can learn nodejs https | http2 module docs
         */
        this.listenApp = http.createServer(this.app);
    }

    /* socket server here */
    createSocketServer() {
        this.sockServer = new SockJsServer(this);
        // this.sockServer.onConnection();
        this.sockServer.onConnection((connection, headers) => {
            this.sockets.push(connection);
            /**
             * close connection
             * unscribtion
             */
            this.sockServer.onConnectionClose(connection, () => {
                let i = this.sockets.indexOf(connection);
                if (i != -1) {
                    this.sockets.splice(i, 1);
                }
            });
        });
    }

    /* listen port */
    listen(port, hostname = 'localhost', callback) {
        this.listenApp.listen(port, hostname, err => {
            this.createSocketServer();
            callback && callback(err);
        });
    }

    /* send message */
    sockWrite(sockets, type, data) {
        sockets.forEach(socket => {
            this.sockServer.send(socket, JSON.stringify({ type, data }));
        });
    }

    /* send status */
    _sendStatus(sockets, stats) {
        this.sockWrite(sockets, 'ok');
    }
}

module.exports = Server;
