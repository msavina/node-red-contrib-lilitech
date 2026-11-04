'use strict';

const sockets = require('../lib/families/sockets');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo socket: in ingresso accende/spegne le prese e ne azzera le misure, in uscita emette lo stato ricevuto dal tubo
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechSocketNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, sockets);
    }

    RED.nodes.registerType('lilitech-socket', LilitechSocketNode);
};
