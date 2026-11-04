'use strict';

const irrigations = require('../lib/families/irrigations');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo irrigation: in ingresso avvia/ferma la centralina irrigazione e i suoi programmi, in uscita emette lo stato
        e i programmi ricevuti dal tubo
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechIrrigationNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, irrigations);
    }

    RED.nodes.registerType('lilitech-irrigation', LilitechIrrigationNode);
};
