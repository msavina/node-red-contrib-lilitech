'use strict';

const systems = require('../lib/families/systems');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo system: emette i valori dell'orologio (alba, tramonto, notte) e del meteo. Senza input: sono in sola lettura
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechSystemNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, systems);
    }

    RED.nodes.registerType('lilitech-system', LilitechSystemNode);
};
