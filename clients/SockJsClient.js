'use strict';

/**
 * sock js client class
 */

const sockjs = require('sockjs-client');

class SockJsClient {
    constructor(url) {
        this.sock = new sockjs(url);
    }

    onOpen(f) {
        this.sock.onopen = f;
    }

    onMessage(f) {
        this.sock.onmessage = f;
    }

    onClose(f) {
        this.sock.onclose = f;
    }
}

module.exports = SockJsClient;