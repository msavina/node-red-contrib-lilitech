'use strict';

const simulators = require('../lib/families/simulators');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo simulator: in ingresso avvia/ferma la simulazione presenza e i suoi programmi, in uscita emette lo stato
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechSimulatorNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, simulators);
    }

    RED.nodes.registerType('lilitech-simulator', LilitechSimulatorNode);
};
