'use strict';

const sockjs = require('sockjs');

/**
 * sockjs server here
 */
class SockJsServer {
    constructor(server) {
        this.server = server;
        this.sockServer = sockjs.createServer({
            sockjs_url: 'bundle.js',
            log(severity, line) {
                // ignore log
            }
        });

        this.sockServer.installHandlers(this.server.listenApp, {
            prefix: this.server.sockPath,
        });
    }

    send(connection, message) {
        if(connection.readyState != 1) {
            return; 
        }
        connection.write(message);
    }

    onConnection(f) {
        this.sockServer.on('connection', (connection) => {
            f(connection, connection ? connection.headers : null);
            // console.log(connection);
        });
    }

    onConnectionClose(connection, f) {
        connection.on('close', f);
    }
}

module.exports = SockJsServer;
