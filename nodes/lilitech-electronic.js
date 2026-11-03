'use strict';

const electronics = require('../lib/families/electronics');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo electronic: solo uscita, emette lo stato online/offline del dispositivo ricevuto dal tubo
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechElectronicNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, electronics);
    }

    RED.nodes.registerType('lilitech-electronic', LilitechElectronicNode);
};
