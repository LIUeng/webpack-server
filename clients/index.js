'use strict';

/**
 * clients
 */
const SockJsClient = require('./SockJsClient');

let retries = 0;
let sockClient = null;
let url = 'http://localhost:9999/sockjs-node';

/**
 * msg handlers
 */
const installHandlers = {
    close() {
        console.log('close');
    },

    ok() {
        self.location.reload();
    },
};

try {
    /**
     * default example:
     * protocal: http
     * host: localhost
     * port: 9999
     * pathname: sockjs-node
     * url: http://localhost:9999/sockjs-node
     */
    let socket = function initSocket(url, handlers) {
        sockClient = new SockJsClient(url);

        sockClient.onOpen(() => {
            console.log('open');
            retries = 0;
        });

        sockClient.onClose(() => {
            if (retries == 0) {
                handlers.close();
            }

            sockClient = null;

            // After 10 times stop print log
            if (retries <= 10) {
                retries += 1;
                let timegap = 1000 * Math.pow(2, retries);
                setTimeout(() => {
                    socket(url, handlers);
                }, timegap);
            }
        });

        sockClient.onMessage(({ data }) => {
            console.log(data);
            let msg = JSON.parse(data);
            if (handlers[msg.type]) {
                handlers[msg.type]();
            }
        });
    };

    // start
    socket(url, installHandlers);
} catch (err) {
    if (err) return console.log(err);
    process.exit(1);
}
