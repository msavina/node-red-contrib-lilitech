'use strict';

const energyManagements = require('../lib/families/energy-managements');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo energy management: in ingresso avvia/ferma la centralina di controllo carichi, in uscita emette potenze,
        flussi e badge ricevuti dal tubo
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechEnergyManagementNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, energyManagements);
    }

    RED.nodes.registerType('lilitech-energy-management', LilitechEnergyManagementNode);
};
